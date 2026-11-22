// T5.2 · "Conferir / Ajustar saldo atual": o saldo fica EXATAMENTE no que a pessoa informou, o ajuste não é gasto nem renda.
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { CreateManualAccountUseCase } from './create-manual-account.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { DeleteTransactionUseCase } from './delete-transaction.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { ADJUSTMENT_DESCRIPTION, ReconcileBalanceUseCase } from './reconcile-balance.js';

const NOW = new Date('2026-11-20T15:00:00Z');

async function setup(balance = 1000_00) {
  const repos = makeInMemoryRepositories();
  const { account } = await new CreateManualAccountUseCase(repos).execute({
    userId: 'u1',
    name: 'Cofre',
    type: 'BANK',
    balanceInCents: balance,
  });
  const reconcile = new ReconcileBalanceUseCase(repos, () => NOW);
  const balance$ = async () => (await repos.accounts.listByUser('u1')).find((a) => a.id === account.id)!.balanceInCents;
  return { repos, account, reconcile, balance$ };
}

describe('ReconcileBalanceUseCase', () => {
  it('saldo menor que o do app: lança o ajuste negativo e o saldo fica igual ao informado', async () => {
    const { reconcile, account, balance$, repos } = await setup();
    const r = await reconcile.execute({ userId: 'u1', accountId: account.id, targetBalanceInCents: 987_65 });
    expect(r).toMatchObject({ deltaInCents: -12_35, balanceInCents: 987_65 });
    expect(await balance$()).toBe(987_65);
    const t = await repos.transactions.findById(r.transactionId!);
    expect(t).toMatchObject({
      description: ADJUSTMENT_DESCRIPTION,
      amountInCents: -12_35,
      isInternalTransfer: true,
      internalTransferManual: true,
    });
  });

  it('saldo maior: ajuste positivo', async () => {
    const { reconcile, account, balance$ } = await setup();
    expect(
      (await reconcile.execute({ userId: 'u1', accountId: account.id, targetBalanceInCents: 1000_05 })).deltaInCents,
    ).toBe(5);
    expect(await balance$()).toBe(1000_05);
  });

  it('já bate: não lança nada', async () => {
    const { reconcile, account, repos } = await setup();
    const r = await reconcile.execute({ userId: 'u1', accountId: account.id, targetBalanceInCents: 1000_00 });
    expect(r).toEqual({ deltaInCents: 0, balanceInCents: 1000_00, transactionId: null });
    expect(await repos.transactions.findManualByUser('u1')).toHaveLength(0);
  });

  it('o ajuste NÃO vira gasto nem renda no mês', async () => {
    const { reconcile, account, repos } = await setup();
    await new CreateManualTransactionUseCase(repos, () => NOW).execute({
      userId: 'u1',
      description: 'Mercado',
      amountInCents: 100_00,
      kind: 'saida',
      occurredAt: NOW,
      accountId: account.id,
    });
    await reconcile.execute({ userId: 'u1', accountId: account.id, targetBalanceInCents: 700_00 }); // -200,00 de ajuste
    const s = await new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId: 'u1', month: '2026-11' });
    expect(s.outcomeInCents).toBe(100_00); // só o mercado
    expect(s.incomeInCents).toBe(0);
    expect(s.balanceInCents).toBe(700_00);
  });

  it('dois ajustes seguidos: o segundo parte do saldo já ajustado', async () => {
    const { reconcile, account, balance$ } = await setup();
    await reconcile.execute({ userId: 'u1', accountId: account.id, targetBalanceInCents: 900_00 });
    const r2 = await reconcile.execute({ userId: 'u1', accountId: account.id, targetBalanceInCents: 950_00 });
    expect(r2.deltaInCents).toBe(50_00);
    expect(await balance$()).toBe(950_00);
  });

  it('apagar o ajuste devolve o saldo (a edição/apagar de conta manual continua coerente)', async () => {
    const { reconcile, account, balance$, repos } = await setup();
    const r = await reconcile.execute({ userId: 'u1', accountId: account.id, targetBalanceInCents: 900_00 });
    await new DeleteTransactionUseCase(repos).execute({ userId: 'u1', transactionId: r.transactionId! });
    expect(await balance$()).toBe(1000_00);
  });

  it('conta ligada ao banco é recusada (o saldo dela vem do banco)', async () => {
    const { repos, reconcile } = await setup();
    const conn = await repos.connections.create({ userId: 'u1', itemId: 'item-real', institution: 'Banco' });
    const acc = await repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'pl-1',
      name: 'Conta',
      type: 'BANK',
      balanceInCents: 5,
      fingerprint: null,
    });
    await expect(
      reconcile.execute({ userId: 'u1', accountId: acc.id, targetBalanceInCents: 10 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('conta IMPORTADA aceita; conta de outra pessoa e id inexistente dão 404', async () => {
    const { repos, reconcile, account } = await setup();
    const conn = await repos.connections.create({ userId: 'u1', itemId: 'import:nubank', institution: 'Nubank' });
    const imported = await repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'import:nubank:u1',
      name: 'Nubank',
      type: 'BANK',
      balanceInCents: 100_00,
      fingerprint: null,
    });
    const r = await reconcile.execute({ userId: 'u1', accountId: imported.id, targetBalanceInCents: 150_00 });
    expect(r.deltaInCents).toBe(50_00);
    expect((await repos.accounts.listByUser('u1')).find((a) => a.id === imported.id)!.balanceInCents).toBe(150_00);
    await expect(
      reconcile.execute({ userId: 'outra', accountId: account.id, targetBalanceInCents: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      reconcile.execute({ userId: 'u1', accountId: 'nao-existe', targetBalanceInCents: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('cartão manual: o "saldo" é a fatura negativa', async () => {
    const { repos, reconcile } = await setup();
    const { account: card } = await new CreateManualAccountUseCase(repos).execute({
      userId: 'u1',
      name: 'Cartão do pai',
      type: 'CREDIT',
      balanceInCents: 300_00,
    });
    expect(card.balanceInCents).toBe(-300_00);
    const r = await reconcile.execute({ userId: 'u1', accountId: card.id, targetBalanceInCents: -320_00 });
    expect(r.deltaInCents).toBe(-20_00);
  });
});
