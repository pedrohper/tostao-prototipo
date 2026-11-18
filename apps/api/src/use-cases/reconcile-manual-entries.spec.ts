import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { UpdateTransactionUseCase } from './update-transaction.js';
import { ImportStatementUseCase } from './import-statement.js';
import { ListNotesUseCase } from './list-notes.js';
import { descriptionsLookAlike } from '../services/reconcile-manual.js';
import { AppError } from '../domain/errors.js';

const NOW = new Date(Date.UTC(2026, 10, 20, 18)); // 20/11/2026
// O banco de exemplo lança NETFLIX.COM (−R$ 57,90) no dia 9 e SPOTIFY (−R$ 21,90) no dia 3.
const NETFLIX_DAY = new Date(Date.UTC(2026, 10, 9, 15));

describe('descriptionsLookAlike', () => {
  it('casa palavra em comum, sem acento nem caixa', () => {
    expect(descriptionsLookAlike('Netflix', 'NETFLIX.COM')).toBe(true);
    expect(descriptionsLookAlike('Pizza', 'IFOOD *PIZZARIA BELLA')).toBe(true);
    expect(descriptionsLookAlike('Açaí do Zé', 'IFD*ACAI DO ZE')).toBe(true);
  });
  it('ignora ruído de extrato e parcelas', () => {
    expect(descriptionsLookAlike('Pix', 'PIX ENVIADO')).toBe(false);
    expect(descriptionsLookAlike('Netflix (2/5)', 'NETFLIX.COM')).toBe(true);
  });
  it('não casa coisas diferentes, nem quando só uma palavra genérica é igual', () => {
    expect(descriptionsLookAlike('Netflix', 'SPOTIFY')).toBe(false);
    expect(descriptionsLookAlike('Mercado Livre', 'Supermercado Extra')).toBe(false);
    expect(descriptionsLookAlike('Mercado Livre', 'MERCADO PAGO')).toBe(false);
  });
});

describe('anotação à mão some quando a cobrança real chega no sync', () => {
  let repos: ReturnType<typeof makeInMemoryRepositories>;
  let manual: CreateManualTransactionUseCase;
  let connect: ConnectBankUseCase;

  beforeEach(() => {
    repos = makeInMemoryRepositories();
    const bank = new FakeBankGateway(() => NOW);
    const sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
    connect = new ConnectBankUseCase(repos.connections, bank, sync);
    manual = new CreateManualTransactionUseCase(repos);
  });

  const note = (description: string, amountInCents: number, occurredAt: Date, extra: { note?: string } = {}) =>
    manual.execute({ userId: 'u1', description, amountInCents, kind: 'saida', occurredAt, ...extra });

  it('apaga a anotada quando há 1 cobrança igual (valor, data e nome)', async () => {
    await note('Netflix', 5790, new Date(NETFLIX_DAY.getTime() - 86_400_000)); // anotou 1 dia antes
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });

    const netflix = repos.transactions.items.filter((t) => /netflix/i.test(t.description));
    expect(netflix).toHaveLength(1);
    expect(netflix[0]!.externalId).not.toBeNull(); // ficou a do banco
  });

  it('passa a nota e a categoria da anotada pra cobrança do banco', async () => {
    await manual.execute({
      userId: 'u1',
      description: 'Netflix',
      amountInCents: 5790,
      kind: 'saida',
      occurredAt: NETFLIX_DAY,
      categoryId: 'assinaturas',
      note: 'plano da família, divide com a mãe',
    });
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });

    const bankTx = repos.transactions.items.find((t) => /netflix/i.test(t.description))!;
    expect(bankTx.note).toBe('plano da família, divide com a mãe');
    expect(bankTx.categoryId).toBe('assinaturas');
  });

  it('não apaga se o valor é diferente', async () => {
    await note('Netflix', 5990, NETFLIX_DAY);
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    expect(repos.transactions.items.filter((t) => /netflix/i.test(t.description))).toHaveLength(2);
  });

  it('não apaga se a data está longe (mais de 5 dias)', async () => {
    await note('Netflix', 5790, new Date(Date.UTC(2026, 10, 1, 15)));
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    expect(repos.transactions.items.filter((t) => /netflix/i.test(t.description))).toHaveLength(2);
  });

  it('não apaga se o nome não tem nada a ver', async () => {
    await note('Cinema', 5790, NETFLIX_DAY);
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    expect(repos.transactions.items.some((t) => t.description === 'Cinema')).toBe(true);
  });

  it('com duas anotadas iguais pra 1 cobrança, não apaga nenhuma (ambíguo)', async () => {
    await note('Netflix', 5790, NETFLIX_DAY);
    await note('Netflix', 5790, NETFLIX_DAY);
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    expect(repos.transactions.items.filter((t) => t.externalId === null)).toHaveLength(2);
  });

  it('só apaga a ocorrência do mês numa série "todo mês", sem mexer nas outras', async () => {
    await manual.execute({
      userId: 'u1',
      description: 'Netflix',
      amountInCents: 5790,
      kind: 'saida',
      occurredAt: NETFLIX_DAY,
      repeat: 'mensal',
    });
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });

    const manuals = repos.transactions.items.filter((t) => t.externalId === null);
    expect(manuals).toHaveLength(11); // 12 lançadas − a de novembro
    expect(manuals.every((t) => t.seriesId !== null)).toBe(true);
  });

  it('não mexe nas anotadas de outra pessoa', async () => {
    await manual.execute({
      userId: 'u2',
      description: 'Netflix',
      amountInCents: 5790,
      kind: 'saida',
      occurredAt: NETFLIX_DAY,
    });
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    expect(repos.transactions.items.filter((t) => t.userId === 'u2')).toHaveLength(1);
  });

  it('pega também a anotação feita depois da cobrança já ter chegado (próximo sync)', async () => {
    const { connection } = await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    await note('Netflix', 5790, NETFLIX_DAY);
    const bank = new FakeBankGateway(() => NOW);
    await new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW }).execute({ connectionId: connection.id });

    expect(repos.transactions.items.filter((t) => /netflix/i.test(t.description))).toHaveLength(1);
  });
});

describe('tela Anotações', () => {
  it('lista o que foi anotado à mão e o histórico do que o app apagou sozinho', async () => {
    const repos = makeInMemoryRepositories();
    const manual = new CreateManualTransactionUseCase(repos);
    await manual.execute({
      userId: 'u1',
      description: 'Netflix',
      amountInCents: 5790,
      kind: 'saida',
      occurredAt: NETFLIX_DAY,
      note: 'plano da família',
    });
    await manual.execute({
      userId: 'u1',
      description: 'Pastel na feira',
      amountInCents: 1200,
      kind: 'saida',
      occurredAt: new Date(Date.UTC(2026, 10, 15, 15)),
    });
    await manual.execute({ userId: 'u2', description: 'Do outro', amountInCents: 100, kind: 'saida', occurredAt: NOW });

    const bank = new FakeBankGateway(() => NOW);
    const sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
    await new ConnectBankUseCase(repos.connections, bank, sync).execute({ userId: 'u1', itemId: 'item-123456' });

    const r = await new ListNotesUseCase(repos).execute({ userId: 'u1' });

    // Netflix saiu da lista de anotadas (foi confirmada); a do pastel continua; a do u2 não aparece.
    expect(r.entries.map((e) => e.description)).toEqual(['Pastel na feira']);
    expect(r.confirmed).toHaveLength(1);
    expect(r.confirmed[0]).toMatchObject({
      description: 'Netflix',
      amountInCents: -5790,
      note: 'plano da família',
      bankDescription: 'NETFLIX.COM',
    });
    expect(r.confirmed[0]!.bankTransactionId).toBe(
      repos.transactions.items.find((t) => t.description === 'NETFLIX.COM')!.id,
    );
  });

  it('histórico de outro usuário não vaza', async () => {
    const repos = makeInMemoryRepositories();
    await repos.reconciledNotes.create({
      userId: 'u2',
      description: 'Segredo',
      amountInCents: -100,
      occurredAt: NOW,
      categoryId: null,
      note: null,
      bankTransactionId: null,
      bankDescription: 'X',
    });
    const r = await new ListNotesUseCase(repos).execute({ userId: 'u1' });
    expect(r).toEqual({ entries: [], confirmed: [] });
  });
});

describe('proteções da reconciliação', () => {
  it('cobrança de conta oculta não apaga a anotação', async () => {
    const repos = makeInMemoryRepositories();
    const conn = await repos.connections.create({ userId: 'u1', itemId: 'item-h', institution: 'Banco' });
    const acc = await repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'h1',
      name: 'Poupança',
      type: 'BANK',
      balanceInCents: 0,
      fingerprint: null,
    });
    await repos.accounts.setHidden(acc.id, true);
    await repos.transactions.create({
      userId: 'u1',
      accountId: acc.id,
      externalId: 'x1',
      description: 'NETFLIX.COM',
      amountInCents: -5790,
      occurredAt: NETFLIX_DAY,
      categoryId: null,
      isInternalTransfer: false,
    });
    await new CreateManualTransactionUseCase(repos).execute({
      userId: 'u1',
      description: 'Netflix',
      amountInCents: 5790,
      kind: 'saida',
      occurredAt: NETFLIX_DAY,
    });
    const { reconcileManualEntries } = await import('./reconcile-manual-entries.js');
    const r = await reconcileManualEntries(
      repos,
      'u1',
      { from: new Date(NETFLIX_DAY.getTime() - 86_400_000), to: NOW },
      new Set([acc.id]),
    );
    expect(r.removedCount).toBe(0);
    expect(repos.transactions.items).toHaveLength(2);
  });

  it('se a reconciliação falhar, o sync continua valendo e a conexão não vira ERROR', async () => {
    const repos = makeInMemoryRepositories();
    const bank = new FakeBankGateway(() => NOW);
    const sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
    const { connection } = await new ConnectBankUseCase(repos.connections, bank, sync).execute({
      userId: 'u1',
      itemId: 'item-123456',
    });
    const original = repos.transactions.delete.bind(repos.transactions);
    repos.transactions.delete = async () => {
      throw new Error('boom');
    };
    await new CreateManualTransactionUseCase(repos).execute({
      userId: 'u1',
      description: 'Netflix',
      amountInCents: 5790,
      kind: 'saida',
      occurredAt: NETFLIX_DAY,
    });
    await expect(sync.execute({ connectionId: connection.id })).resolves.toBeDefined();
    expect((await repos.connections.findById(connection.id))!.status).toBe('ACTIVE');
    repos.transactions.delete = original;
  });
});

describe('anotação à mão some quando o extrato importado confirma', () => {
  it('apaga a anotada que bate com a linha do arquivo e mantém a do extrato', async () => {
    const repos = makeInMemoryRepositories();
    await new CreateManualTransactionUseCase(repos).execute({
      userId: 'u1',
      description: 'Ifood açaí',
      amountInCents: 3000,
      kind: 'saida',
      occurredAt: new Date('2026-11-03T15:00:00Z'),
      note: 'com a Ana',
    });
    const csv = 'Data,Valor,Identificador,Descrição\n04/11/2026,-30.00,a2,IFOOD *ACAI';
    const r = await new ImportStatementUseCase(repos).execute({
      userId: 'u1',
      accountName: 'Itaú',
      fileName: 'itau.csv',
      content: csv,
    });

    expect(r).toMatchObject({ importedCount: 1, reconciledCount: 1 });
    expect(repos.transactions.items).toHaveLength(1);
    expect(repos.transactions.items[0]).toMatchObject({ description: 'IFOOD *ACAI', note: 'com a Ana' });
  });
});

describe('nota na transação', () => {
  it('grava a nota ao anotar, e apagar a nota com texto vazio', async () => {
    const repos = makeInMemoryRepositories();
    const { transaction } = await new CreateManualTransactionUseCase(repos).execute({
      userId: 'u1',
      description: 'Pizza',
      amountInCents: 5000,
      kind: 'saida',
      occurredAt: NOW,
      note: 'rachei com o João',
    });
    expect(transaction.note).toBe('rachei com o João');

    const update = new UpdateTransactionUseCase(repos);
    await update.execute({ userId: 'u1', transactionId: transaction.id, note: '' });
    expect(repos.transactions.items[0]!.note).toBeNull();
  });

  it('deixa editar a nota de transação do banco, mas continua barrando valor/descrição/data', async () => {
    const repos = makeInMemoryRepositories();
    const t = await repos.transactions.create({
      userId: 'u1',
      accountId: 'a1',
      externalId: 'ext-1',
      description: 'SPOTIFY',
      amountInCents: -2190,
      occurredAt: NOW,
      categoryId: null,
      isInternalTransfer: false,
    });
    const update = new UpdateTransactionUseCase(repos);

    await update.execute({ userId: 'u1', transactionId: t.id, note: 'plano duo' });
    expect((await repos.transactions.findById(t.id))!.note).toBe('plano duo');
    await expect(update.execute({ userId: 'u1', transactionId: t.id, amountInCents: -100 })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('não deixa editar a nota de transação de outra pessoa', async () => {
    const repos = makeInMemoryRepositories();
    const t = await repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: null,
      description: 'Pizza',
      amountInCents: -5000,
      occurredAt: NOW,
      categoryId: null,
      isInternalTransfer: false,
    });
    await expect(
      new UpdateTransactionUseCase(repos).execute({ userId: 'u2', transactionId: t.id, note: 'invadi' }),
    ).rejects.toThrow();
  });
});
