import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { AccountDetailUseCase } from './account-detail.js';

describe('detalhe da conta/cartão', () => {
  it('soma o mês do cartão, separa por categoria, guarda histórico e parcelas que faltam', async () => {
    const repos = makeInMemoryRepositories();
    const u = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: 'x' });
    const conn = await repos.connections.create({ userId: u.id, itemId: 'i', institution: 'Nubank' });
    const card = await repos.accounts.upsertByExternalId({ userId: u.id, connectionId: conn.id, externalId: 'c', name: 'Nubank', type: 'CREDIT', balanceInCents: -30000, fingerprint: null, creditLimitInCents: 100000, dueDate: new Date('2026-11-20T00:00:00Z') });
    const bank = await repos.accounts.upsertByExternalId({ userId: u.id, connectionId: conn.id, externalId: 'b', name: 'Conta', type: 'BANK', balanceInCents: 5000, fingerprint: null, creditLimitInCents: null, dueDate: null });
    const tx = (accountId: string, date: string, cents: number, description: string, categoryId: string | null, internal = false) =>
      repos.transactions.create({ userId: u.id, accountId, externalId: `${date}${cents}`, description, amountInCents: cents, occurredAt: new Date(`${date}T15:00:00Z`), categoryId, isInternalTransfer: internal });
    await tx(card.id, '2026-11-05', -5000, 'IFOOD', 'delivery');
    await tx(card.id, '2026-11-06', -10000, 'LOJA X 2/5', 'compras');
    await tx(card.id, '2026-11-07', 30000, 'Pagamento recebido', null, true);
    await tx(card.id, '2026-10-05', -7000, 'IFOOD', 'delivery');
    await tx(bank.id, '2026-11-05', -999, 'PADARIA', null);
    const r = await new AccountDetailUseCase(repos, () => new Date('2026-11-12T15:00:00Z')).execute({ userId: u.id, accountId: card.id, month: '2026-11' });
    expect(r.account).toMatchObject({ type: 'CREDIT', institution: 'Nubank', creditLimitInCents: 100000 });
    expect(r.outInCents).toBe(15000);
    expect(r.transactions).toHaveLength(3);
    expect(r.byCategory.map((c) => [c.categoryId, c.totalInCents])).toEqual([['compras', 10000], ['delivery', 5000]]);
    expect(r.history.map((h) => h.outInCents).slice(-2)).toEqual([7000, 15000]);
    expect(r.installments).toEqual([{ description: 'LOJA X', amountInCents: 10000, n: 2, total: 5, left: 3 }]);
    expect(r.upcoming.map((x) => x.amountInCents)).toEqual([10000, 10000, 10000]);
    await expect(new AccountDetailUseCase(repos).execute({ userId: 'outro', accountId: card.id, month: '2026-11' })).rejects.toThrow();
  });
});
