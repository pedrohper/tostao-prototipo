// T1.5 · resumo do mês: saldo histórico (conta conectada x manual), fuso da pessoa e vencimento de cartão.
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { civilMonth } from '../lib/tz.js';
import { CreateManualAccountUseCase } from './create-manual-account.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { GetMonthSummaryUseCase, nextDueDate } from './get-month-summary.js';

const NOW = new Date('2026-11-20T15:00:00Z');
const base = { fingerprint: null, hidden: false };

async function bank(repos: ReturnType<typeof makeInMemoryRepositories>, itemId = 'item-1') {
  const conn = await repos.connections.create({ userId: 'u1', itemId, institution: 'Banco' });
  const acc = await repos.accounts.upsertByExternalId({
    userId: 'u1',
    connectionId: conn.id,
    externalId: `${itemId}:cc`,
    name: 'Corrente',
    type: 'BANK',
    balanceInCents: 1000_00,
    ...base,
  });
  return acc;
}
const tx = (
  repos: ReturnType<typeof makeInMemoryRepositories>,
  accountId: string | null,
  externalId: string | null,
  amount: number,
  at: string,
) =>
  repos.transactions.create({
    userId: 'u1',
    accountId,
    externalId,
    description: externalId ? 'MOVIMENTO BANCO' : 'Anotado',
    amountInCents: amount,
    occurredAt: new Date(at),
    categoryId: null,
    isInternalTransfer: false,
    seriesId: null,
  });

describe('saldo no fim de um mês passado', () => {
  it('conta CONECTADA: desfaz só os movimentos do banco; anotação à mão (nunca entrou no saldo do banco) não distorce', async () => {
    const repos = makeInMemoryRepositories();
    const acc = await bank(repos);
    await tx(repos, acc.id, 'ext-1', -200_00, '2026-11-05T15:00:00Z'); // depois do fim de outubro, no saldo do banco
    await tx(repos, acc.id, null, -50_00, '2026-11-06T15:00:00Z'); // anotado à mão numa conta conectada: NÃO está no saldo
    const s = await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: 'u1', month: '2026-10' });
    // saldo hoje 1000; desfaz só o movimento do banco (-200): 1000 - (-200) = 1200
    expect(s.balanceInCents).toBe(1200_00);
  });

  it('conta MANUAL: o saldo é mantido pelo app, então desfaz os lançamentos dela', async () => {
    const repos = makeInMemoryRepositories();
    const { account } = await new CreateManualAccountUseCase(repos).execute({
      userId: 'u1',
      name: 'Cofre',
      type: 'BANK',
      balanceInCents: 500_00,
    });
    // um gasto de R$ 80 em novembro, na conta manual: o saldo cai pra 420 (create ajusta atomicamente)
    await new CreateManualTransactionUseCase(repos, () => NOW).execute({
      userId: 'u1',
      description: 'Compra',
      amountInCents: 80_00,
      kind: 'saida',
      occurredAt: new Date('2026-11-05T15:00:00Z'),
      accountId: account.id,
    });
    expect((await repos.accounts.listByUser('u1'))[0]!.balanceInCents).toBe(420_00);
    const s = await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: 'u1', month: '2026-10' });
    expect(s.balanceInCents).toBe(500_00); // no fim de outubro ainda tinha os R$ 500
  });

  it('mês atual não desfaz nada', async () => {
    const repos = makeInMemoryRepositories();
    const acc = await bank(repos);
    await tx(repos, acc.id, 'ext-1', -200_00, '2026-11-05T15:00:00Z');
    expect(
      (await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: 'u1', month: '2026-11' })).balanceInCents,
    ).toBe(1000_00);
  });
});

describe('fuso da pessoa', () => {
  it('o mês do resumo vem do User.timezone: 01/12 01h em Tóquio já é dezembro, em Brasília ainda é novembro', async () => {
    const repos = makeInMemoryRepositories();
    const user = await repos.users.create({ name: 'Yuki', email: 'y@x.com', passwordHash: null });
    const acc = await bank(repos);
    (await repos.users.findById(user.id))!.timezone = 'Asia/Tokyo';
    await repos.accounts.delete(acc.id);
    const conn = await repos.connections.create({ userId: user.id, itemId: 'item-t', institution: 'B' });
    const a = await repos.accounts.upsertByExternalId({
      userId: user.id,
      connectionId: conn.id,
      externalId: 'x',
      name: 'C',
      type: 'BANK',
      balanceInCents: 0,
      ...base,
    });
    // 2026-11-30T20:00Z = 01/12 05h em Tóquio (dezembro) e 30/11 17h em Brasília (novembro)
    await repos.transactions.create({
      userId: user.id,
      accountId: a.id,
      externalId: 'e',
      description: 'X',
      amountInCents: -10_00,
      occurredAt: new Date('2026-11-30T20:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
      seriesId: null,
    });
    const now = new Date('2026-12-05T00:00:00Z');
    expect(civilMonth(new Date('2026-11-30T20:00:00Z'), 'Asia/Tokyo')).toBe('2026-12');
    const dec = await new GetMonthSummaryUseCase(repos, () => now).execute({ userId: user.id, month: '2026-12' });
    const nov = await new GetMonthSummaryUseCase(repos, () => now).execute({ userId: user.id, month: '2026-11' });
    expect(dec.outcomeInCents).toBe(10_00);
    expect(nov.outcomeInCents).toBe(0);
  });
});

describe('vencimento do cartão pela data civil', () => {
  it('depois das 21h de Brasília o dia UTC já virou, mas o vencimento de hoje ainda é hoje', () => {
    const due = new Date('2026-11-20T00:00:00Z'); // data de calendário (Pluggy)
    const nineThirtyPm = new Date('2026-11-21T00:30:00Z'); // 20/11 21h30 em Brasília
    expect(nextDueDate(due, nineThirtyPm).toISOString()).toBe('2026-11-20T00:00:00.000Z');
    expect(nextDueDate(due, new Date('2026-11-21T12:00:00Z')).toISOString()).toBe('2026-12-20T00:00:00.000Z');
  });
});
