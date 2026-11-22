// T5.3 · importar PDF: pré-visualização, fallback com IA (só com aceite + texto mascarado), confirmação e reimportação.
import { describe, expect, it } from 'vitest';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FIXTURES, makePdf } from '../test-support/make-pdf.js';
import { ImportPdfUseCase, PDF_AI_DAILY_LIMIT } from './import-pdf.js';
import { ImportStatementUseCase } from './import-statement.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';

const NOW = new Date('2026-11-22T15:00:00Z');
const b64 = (lines: readonly string[]) => makePdf([[...lines]]).toString('base64');
const UNKNOWN = [
  'Relatório de movimentações',
  'Titular: Maria Exemplo da Silva',
  'CPF 123.456.789-09',
  'Comprovante: LOJA XPTO dia 05/11 no valor de 10,00',
  'tudo sem layout conhecido ???',
];

async function setup(opts: { consent?: boolean; ai?: FakeAiGateway } = {}) {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Maria', email: 'm@x.com', passwordHash: 'x' });
  if (opts.consent) await repos.users.setAiConsent(user.id, NOW);
  const ai = opts.ai ?? new FakeAiGateway();
  const kv = new MemoryKeyValueStore();
  const uc = new ImportPdfUseCase(repos, new ImportStatementUseCase(repos), ai, kv, () => NOW);
  return { repos, user, ai, kv, uc };
}

describe('pré-visualização', () => {
  it('layout conhecido: devolve as linhas, o banco e o total; NÃO grava nada e NÃO chama a IA', async () => {
    const { uc, user, repos, ai } = await setup({ consent: true });
    const p = await uc.preview(user.id, {
      fileName: 'fatura.pdf',
      contentBase64: b64(FIXTURES.nubankFatura),
      accountName: '',
      allowAi: true,
    });
    expect(p).toMatchObject({
      bank: 'Nubank',
      kind: 'CREDIT',
      source: 'layout',
      totalInCents: 170_05,
      statedTotalInCents: 170_05,
      aiBlockedReason: null,
      suggestedAccountName: 'Nubank cartão',
    });
    expect(p.rows).toHaveLength(4);
    expect(repos.transactions.items).toHaveLength(0);
    expect(repos.accounts.items).toHaveLength(0);
    expect(ai.calls).toHaveLength(0);
  });

  it('não-PDF (mesmo "fatura.pdf") e PDF corrompido: 400 com mensagem amigável', async () => {
    const { uc, user } = await setup();
    await expect(
      uc.preview(user.id, {
        fileName: 'fatura.pdf',
        contentBase64: Buffer.from('<html>oi oi oi oi oi oi</html>').toString('base64'),
        accountName: '',
        allowAi: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Esse arquivo não é um PDF.' });
    const corrupted = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('lixo '.repeat(80))]).toString('base64');
    await expect(
      uc.preview(user.id, { fileName: 'a.pdf', contentBase64: corrupted, accountName: '', allowAi: true }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('o nome da conta sugerido respeita o que a pessoa digitou', async () => {
    const { uc, user } = await setup();
    const p = await uc.preview(user.id, {
      fileName: 'x.pdf',
      contentBase64: b64(FIXTURES.interExtrato),
      accountName: 'Minha conta',
      allowAi: true,
    });
    expect(p.suggestedAccountName).toBe('Minha conta');
  });
});

describe('fallback com IA (DeepSeek)', () => {
  const AI_JSON = JSON.stringify({
    bank: 'Banco X',
    kind: 'BANK',
    rows: [{ date: '2026-11-05', description: 'LOJA XPTO', amountInCents: -1000 }],
  });

  it('SEM aceite da IA: nada sai do servidor (zero chamadas) e a resposta explica o motivo', async () => {
    const ai = new FakeAiGateway();
    ai.next = AI_JSON;
    const { uc, user } = await setup({ consent: false, ai });
    const p = await uc.preview(user.id, {
      fileName: 'x.pdf',
      contentBase64: b64(UNKNOWN),
      accountName: '',
      allowAi: true,
    });
    expect(ai.calls).toHaveLength(0);
    expect(p).toMatchObject({ rows: [], source: 'layout', aiBlockedReason: 'no_consent' });
  });

  it('COM aceite: usa a IA, só com as linhas de lançamento MASCARADAS (cabeçalho com nome/CPF nunca vai)', async () => {
    const ai = new FakeAiGateway();
    ai.next = AI_JSON;
    const { uc, user } = await setup({ consent: true, ai });
    const p = await uc.preview(user.id, {
      fileName: 'x.pdf',
      contentBase64: b64(UNKNOWN),
      accountName: '',
      allowAi: true,
    });
    expect(ai.calls).toHaveLength(1);
    const sent = ai.calls[0]!.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
    expect(sent).toContain('LOJA XPTO');
    expect(sent).not.toContain('Maria Exemplo'); // cabeçalho com o nome: fora
    expect(sent).not.toMatch(/123\.456\.789-09/); // CPF: fora
    expect(p).toMatchObject({ source: 'ai', bank: 'Banco X', aiBlockedReason: null });
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ date: '2026-11-05', description: 'LOJA XPTO', amountInCents: -10_00 });
    expect(p.warnings.join(' ')).toMatch(/IA/);
  });

  it('o texto que vai pra IA passa pelo scrubFinancialText (CPF/CNPJ/telefone/e-mail numa linha de lançamento)', async () => {
    const ai = new FakeAiGateway();
    ai.next = AI_JSON;
    const { uc, user } = await setup({ consent: true, ai });
    const lines = [
      'Relatório',
      'Comprovante CPF 123.456.789-09 email maria@x.com tel (11) 91234-5678 valor 10,00',
      'Comprovante 05/11 PIX ENVIADO JOAO DA SILVA 25,50',
    ];
    await uc.preview(user.id, { fileName: 'x.pdf', contentBase64: b64(lines), accountName: '', allowAi: true });
    const sent = ai.calls[0]!.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
    expect(sent).not.toMatch(/123\.456\.789-09|maria@x\.com|91234-5678|JOAO DA SILVA/);
    expect(sent).toMatch(/\[CPF\].*\[EMAIL\].*\[TEL\].*10,00/);
    expect(sent).toMatch(/PIX ENVIADO \[PESSOA\] 25,50/); // a máscara do nome NÃO leva o valor junto
  });

  it('allowAi:false (a pessoa não quer) e IA desligada (sem chave): não chama e explica', async () => {
    const off = await setup({ consent: true });
    const p1 = await off.uc.preview(off.user.id, {
      fileName: 'x.pdf',
      contentBase64: b64(UNKNOWN),
      accountName: '',
      allowAi: true,
    });
    expect(p1.aiBlockedReason).toBe('disabled'); // FakeAiGateway sem resposta = enabled:false
    const ai = new FakeAiGateway();
    ai.next = AI_JSON;
    const on = await setup({ consent: true, ai });
    const p2 = await on.uc.preview(on.user.id, {
      fileName: 'x.pdf',
      contentBase64: b64(UNKNOWN),
      accountName: '',
      allowAi: false,
    });
    expect(p2.aiBlockedReason).toBe('disabled');
    expect(ai.calls).toHaveLength(0);
  });

  it('resposta da IA com lixo (data inválida, valor zero, JSON quebrado) é descartada, nunca gravada', async () => {
    const ai = new FakeAiGateway();
    ai.next = JSON.stringify({
      rows: [
        { date: '2026-02-31', description: 'X', amountInCents: -100 },
        { date: '2026-11-05', description: 'Y', amountInCents: 0 },
        { date: '05/11', description: 'Z', amountInCents: -5 },
      ],
    });
    const { uc, user } = await setup({ consent: true, ai });
    expect(
      (await uc.preview(user.id, { fileName: 'x.pdf', contentBase64: b64(UNKNOWN), accountName: '', allowAi: true }))
        .rows,
    ).toEqual([]);
    ai.next = '{isto não é json';
    expect(
      (await uc.preview(user.id, { fileName: 'x.pdf', contentBase64: b64(UNKNOWN), accountName: '', allowAi: true }))
        .rows,
    ).toEqual([]);
  });

  it(`cota diária (${PDF_AI_DAILY_LIMIT}): passou, bloqueia sem chamar a IA; leitura que não deu em nada devolve a cota`, async () => {
    const ai = new FakeAiGateway();
    ai.next = '{isto não é json'; // nunca dá certo: a cota volta a cada tentativa
    const { uc, user } = await setup({ consent: true, ai });
    for (let i = 0; i < PDF_AI_DAILY_LIMIT + 2; i++)
      expect(
        (await uc.preview(user.id, { fileName: 'x.pdf', contentBase64: b64(UNKNOWN), accountName: '', allowAi: true }))
          .aiBlockedReason,
      ).toBeNull();
    ai.next = AI_JSON;
    for (let i = 0; i < PDF_AI_DAILY_LIMIT; i++)
      expect(
        (await uc.preview(user.id, { fileName: 'x.pdf', contentBase64: b64(UNKNOWN), accountName: '', allowAi: true }))
          .source,
      ).toBe('ai');
    const calls = ai.calls.length;
    const blocked = await uc.preview(user.id, {
      fileName: 'x.pdf',
      contentBase64: b64(UNKNOWN),
      accountName: '',
      allowAi: true,
    });
    expect(blocked.aiBlockedReason).toBe('quota');
    expect(ai.calls).toHaveLength(calls);
  });
});

describe('confirmar a pré-visualização', () => {
  const preview = async (uc: ImportPdfUseCase, userId: string, lines: readonly string[] = FIXTURES.itauFatura) =>
    uc.preview(userId, { fileName: 'f.pdf', contentBase64: b64(lines), accountName: '', allowAi: true });
  const rowsBody = (p: Awaited<ReturnType<typeof preview>>, over: Record<string, unknown> = {}) => ({
    accountName: p.suggestedAccountName,
    fileName: 'f.pdf',
    isCard: p.kind === 'CREDIT',
    rows: p.rows,
    ...over,
  });

  it('grava as linhas no cartão; reimportar o MESMO PDF não duplica nada', async () => {
    const { uc, user, repos } = await setup();
    const p = await preview(uc, user.id);
    const first = await uc.confirm(user.id, rowsBody(p));
    expect(first).toMatchObject({ importedCount: 3, skipped: 0, kind: 'CREDIT', format: 'pdf' });
    expect(repos.transactions.items).toHaveLength(3);
    expect(repos.accounts.items).toHaveLength(1);
    expect(repos.accounts.items[0]!.type).toBe('CREDIT');
    const again = await uc.confirm(user.id, rowsBody(await preview(uc, user.id)));
    expect(again).toMatchObject({ importedCount: 0, skipped: 3 });
    expect(repos.transactions.items).toHaveLength(3);
  });

  it('editar a descrição/valor na pré-visualização vale, e reimportar o PDF original não duplica (a chave é do original)', async () => {
    const { uc, user, repos } = await setup();
    const p = await preview(uc, user.id);
    const edited = p.rows.map((r, i) =>
      i === 0 ? { ...r, description: 'Supermercado (editado)', amountInCents: -151_00 } : r,
    );
    await uc.confirm(user.id, rowsBody(p, { rows: edited }));
    expect(repos.transactions.items.find((t) => t.description === 'Supermercado (editado)')!.amountInCents).toBe(
      -151_00,
    );
    const again = await uc.confirm(user.id, rowsBody(await preview(uc, user.id)));
    expect(again.importedCount).toBe(0);
    expect(repos.transactions.items).toHaveLength(3);
  });

  it('a pessoa pode tirar linhas (só as que sobraram entram)', async () => {
    const { uc, user, repos } = await setup();
    const p = await preview(uc, user.id);
    await uc.confirm(user.id, rowsBody(p, { rows: p.rows.slice(0, 1) }));
    expect(repos.transactions.items).toHaveLength(1);
  });

  it('concilia a anotação manual que o PDF confirmou (o mesmo caminho do OFX/CSV)', async () => {
    const { uc, user, repos } = await setup();
    await new CreateManualTransactionUseCase(repos, () => NOW).execute({
      userId: user.id,
      description: 'Netflix',
      amountInCents: 55_90,
      kind: 'saida',
      occurredAt: new Date('2026-11-20T15:00:00Z'),
    });
    const r = await uc.confirm(user.id, rowsBody(await preview(uc, user.id)));
    expect(r.reconciledCount).toBe(1);
    expect(repos.transactions.items.filter((t) => /netflix/i.test(t.description))).toHaveLength(1);
  });

  it('a data vira o meio-dia do dia civil da pessoa', async () => {
    const { uc, user, repos } = await setup();
    await uc.confirm(user.id, rowsBody(await preview(uc, user.id)));
    expect(
      repos.transactions.items.find((t) => t.description.startsWith('SUPERMERCADO'))!.occurredAt.toISOString(),
    ).toBe('2026-11-05T15:00:00.000Z');
  });
});
