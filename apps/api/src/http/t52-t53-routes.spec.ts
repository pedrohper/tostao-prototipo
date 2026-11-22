// T5.2 / T5.3 pela API de verdade (Fastify inject): recorrências, ajuste de saldo, vínculo de transferência e PDF.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FIXTURES, makePdf } from '../test-support/make-pdf.js';

const SECRET = 'segredo-de-teste-com-32-caracteres!!';
async function boot() {
  const repos = makeInMemoryRepositories();
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    jwtSecret: SECRET,
    webOrigin: 'https://tostao.test',
  });
  return { app, repos };
}
type App = Awaited<ReturnType<typeof boot>>['app'];
let ipCounter = 0;
const freshIp = () => `10.11.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
async function register(app: App, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { 'x-forwarded-for': freshIp() },
    payload: { name: 'Pessoa', email, password: '12345678', acceptedTerms: true },
  });
  return (res.json() as { accessToken: string }).accessToken;
}
const mkAccount = async (app: App, jwt: string, name: string, type: 'BANK' | 'CREDIT', balanceInCents: number) =>
  (
    await app.inject({
      method: 'POST',
      url: '/accounts',
      headers: bearer(jwt),
      payload: { name, type, balanceInCents },
    })
  ).json().account as { id: string };
const today = () => new Date().toISOString().slice(0, 10);

describe('/recurring-rules', () => {
  it('exige login; cria (lança já se a data chegou), lista, pausa e apaga; isola entre pessoas', async () => {
    const { app } = await boot();
    expect((await app.inject({ method: 'GET', url: '/recurring-rules' })).statusCode).toBe(401);
    const a = await register(app, 'a@exemplo.test');
    const b = await register(app, 'b@exemplo.test');
    const acc = await mkAccount(app, a, 'Carteira', 'BANK', 1000_00);
    const created = await app.inject({
      method: 'POST',
      url: '/recurring-rules',
      headers: bearer(a),
      payload: {
        description: 'Aluguel',
        amountInCents: 300_00,
        kind: 'saida',
        startDate: '2020-01-05',
        accountId: acc.id,
      },
    });
    expect(created.statusCode).toBe(201);
    const rule = created.json().rule as { id: string; postedInstallments: number };
    expect(rule.postedInstallments).toBeGreaterThan(0); // data passada: já lançou
    expect(
      (await app.inject({ method: 'GET', url: '/recurring-rules', headers: bearer(a) })).json().rules,
    ).toHaveLength(1);
    expect(
      (await app.inject({ method: 'GET', url: '/recurring-rules', headers: bearer(b) })).json().rules,
    ).toHaveLength(0);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/recurring-rules/${rule.id}`,
          headers: bearer(b),
          payload: { active: false },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'DELETE', url: `/recurring-rules/${rule.id}`, headers: bearer(b) })).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/recurring-rules/${rule.id}`,
          headers: bearer(a),
          payload: { active: false },
        })
      ).json().rule.active,
    ).toBe(false);
    expect(
      (await app.inject({ method: 'DELETE', url: `/recurring-rules/${rule.id}`, headers: bearer(a) })).statusCode,
    ).toBe(204);
  });

  it('corpo inválido: valor zero, data ruim, parcela 1x, patch vazio, conta de outra pessoa', async () => {
    const { app } = await boot();
    const a = await register(app, 'a@exemplo.test');
    const b = await register(app, 'b@exemplo.test');
    const theirs = await mkAccount(app, b, 'Da B', 'BANK', 1);
    const ok = { description: 'X', amountInCents: 100, kind: 'saida', startDate: today() };
    const post = (payload: unknown) =>
      app.inject({ method: 'POST', url: '/recurring-rules', headers: bearer(a), payload: payload as never });
    expect((await post({ ...ok, amountInCents: 0 })).statusCode).toBe(400);
    expect((await post({ ...ok, startDate: '31/12/2026' })).statusCode).toBe(400);
    expect((await post({ ...ok, totalInstallments: 1 })).statusCode).toBe(400);
    expect((await post({ ...ok, frequency: 'DAILY' })).statusCode).toBe(400);
    expect((await post({ ...ok, accountId: theirs.id })).statusCode).toBe(404);
    const r = (await post(ok)).json().rule as { id: string };
    expect(
      (await app.inject({ method: 'PATCH', url: `/recurring-rules/${r.id}`, headers: bearer(a), payload: {} }))
        .statusCode,
    ).toBe(400);
  });
});

describe('POST /accounts/:id/reconcile-balance', () => {
  it('ajusta o saldo, devolve a diferença; 401 sem login; 404 de outra pessoa; 400 saldo inválido', async () => {
    const { app } = await boot();
    const a = await register(app, 'a@exemplo.test');
    const b = await register(app, 'b@exemplo.test');
    const acc = await mkAccount(app, a, 'Cofre', 'BANK', 1000_00);
    const url = `/accounts/${acc.id}/reconcile-balance`;
    expect((await app.inject({ method: 'POST', url, payload: { targetBalanceInCents: 1 } })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url, headers: bearer(b), payload: { targetBalanceInCents: 1 } })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'POST', url, headers: bearer(a), payload: { targetBalanceInCents: 1.5 } }))
        .statusCode,
    ).toBe(400);
    const r = await app.inject({
      method: 'POST',
      url,
      headers: bearer(a),
      payload: { targetBalanceInCents: 950_00, note: 'tarifa' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ deltaInCents: -50_00, balanceInCents: 950_00 });
  });
});

describe('PATCH /transactions/:id/transfer-link', () => {
  it('liga ao cartão pela rota; presenter mostra linkedAccountId/linkKind; desfaz; 400 sem destino; 404 de outra pessoa', async () => {
    const { app } = await boot();
    const a = await register(app, 'a@exemplo.test');
    const b = await register(app, 'b@exemplo.test');
    const bank = await mkAccount(app, a, 'Conta', 'BANK', 1000_00);
    const card = await mkAccount(app, a, 'Cartão', 'CREDIT', 400_00);
    const created = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: bearer(a),
      payload: {
        description: 'PAG FATURA',
        amountInCents: 400_00,
        kind: 'saida',
        occurredAt: today(),
        accountId: bank.id,
      },
    });
    const id = created.json().id as string;
    const url = `/transactions/${id}/transfer-link`;
    expect(
      (await app.inject({ method: 'PATCH', url, headers: bearer(a), payload: { kind: 'card_payment' } })).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url,
          headers: bearer(b),
          payload: { kind: 'card_payment', targetAccountId: card.id },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url,
          headers: bearer(a),
          payload: { kind: 'card_payment', targetAccountId: card.id },
        })
      ).statusCode,
    ).toBe(200);
    const got = (await app.inject({ method: 'GET', url: `/transactions/${id}`, headers: bearer(a) })).json()
      .transaction;
    expect(got).toMatchObject({
      isInternalTransfer: true,
      linkedAccountId: card.id,
      linkKind: 'card_payment',
      source: 'manual',
    });
    expect((await app.inject({ method: 'PATCH', url, headers: bearer(a), payload: { kind: 'none' } })).statusCode).toBe(
      200,
    );
    expect(
      (await app.inject({ method: 'GET', url: `/transactions/${id}`, headers: bearer(a) })).json().transaction,
    ).toMatchObject({ isInternalTransfer: false, linkedAccountId: null });
  });
});

describe('importar PDF: POST /imports/preview → POST /imports/rows', () => {
  const body = (lines: readonly string[], extra: Record<string, unknown> = {}) => ({
    fileName: 'fatura.pdf',
    contentBase64: makePdf([[...lines]]).toString('base64'),
    ...extra,
  });

  it('pré-visualiza sem gravar, confirma, e reimportar o mesmo PDF não duplica', async () => {
    const { app, repos } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const prev = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: bearer(jwt),
      payload: body(FIXTURES.itauFatura),
    });
    expect(prev.statusCode).toBe(200);
    const p = prev.json();
    expect(p).toMatchObject({ bank: 'Itaú', kind: 'CREDIT', source: 'layout' });
    expect(repos.transactions.items).toHaveLength(0);
    const confirm = () =>
      app.inject({
        method: 'POST',
        url: '/imports/rows',
        headers: bearer(jwt),
        payload: { accountName: p.suggestedAccountName, fileName: 'fatura.pdf', isCard: true, rows: p.rows },
      });
    const first = await confirm();
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ importedCount: 3, skipped: 0, format: 'pdf' });
    expect((await confirm()).json()).toMatchObject({ importedCount: 0, skipped: 3 });
    expect(repos.transactions.items).toHaveLength(3);
  });

  it('401 sem login; não-PDF 400; chave de linha inventada 400; PDF de 8 MB passa pelo limite do corpo', async () => {
    const { app } = await boot();
    expect(
      (await app.inject({ method: 'POST', url: '/imports/preview', payload: body(FIXTURES.itauFatura) })).statusCode,
    ).toBe(401);
    const jwt = await register(app, 'a@exemplo.test');
    const notPdf = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: bearer(jwt),
      payload: { fileName: 'x.pdf', contentBase64: Buffer.from('<html>' + 'a'.repeat(50)).toString('base64') },
    });
    expect(notPdf.statusCode).toBe(400);
    expect(notPdf.json().message).toBe('Esse arquivo não é um PDF.');
    const badKey = await app.inject({
      method: 'POST',
      url: '/imports/rows',
      headers: bearer(jwt),
      payload: {
        accountName: 'X',
        fileName: 'f.pdf',
        isCard: false,
        rows: [{ key: '../../etc', date: '2026-11-05', description: 'x', amountInCents: -1 }],
      },
    });
    expect(badKey.statusCode).toBe(400);
    const big = Buffer.alloc(8 * 1024 * 1024, 0x20);
    big.write('%PDF-1.4\n', 0);
    const res = await app.inject({
      method: 'POST',
      url: '/imports/preview',
      headers: bearer(jwt),
      payload: { fileName: 'g.pdf', contentBase64: big.toString('base64') },
    });
    expect(res.statusCode).toBe(400); // passou do limite de corpo (200 ≠ 413) e falhou por ser PDF inválido, não por tamanho
    expect(res.json().message).not.toMatch(/grande/i);
  });
});
