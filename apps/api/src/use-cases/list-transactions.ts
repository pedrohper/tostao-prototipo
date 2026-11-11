import type { Repositories } from '../repositories/types.js';
import { monthRange } from '../lib/month.js';

export class ListTransactionsUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts'>) {}

  async execute({ userId, month }: { userId: string; month: string }) {
    const { from, to } = monthRange(month);
    const [txs, categories, accounts] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, from, to),
      this.repos.categories.list(),
      this.repos.accounts.listByUser(userId),
    ]);
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const accName = new Map(accounts.map((a) => [a.id, a.name]));
    return {
      transactions: txs.map((t) => ({
        ...t,
        categoryName: t.categoryId ? catName.get(t.categoryId) ?? null : null,
        accountName: t.accountId ? accName.get(t.accountId) ?? null : null,
      })),
    };
  }
}
