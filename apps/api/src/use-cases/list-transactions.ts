import type { Repositories } from '../repositories/types.js';
import { monthRange } from '../lib/month.js';

export class ListTransactionsUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts'>) {}

  async execute({ userId, month }: { userId: string; month: string }) {
    const { from, to } = monthRange(month);
    const [txs, categories, accounts] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, from, to),
      this.repos.categories.list(userId),
      this.repos.accounts.listByUser(userId),
    ]);
    const cat = new Map(categories.map((c) => [c.id, c]));
    const accName = new Map(accounts.map((a) => [a.id, a.name]));
    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
    return {
      transactions: txs.filter((t) => !(t.accountId && hidden.has(t.accountId))).map((t) => ({
        ...t,
        categoryName: t.categoryId ? cat.get(t.categoryId)?.name ?? null : null,
        categoryEmoji: t.categoryId ? cat.get(t.categoryId)?.emoji ?? null : null,
        categoryColor: t.categoryId ? cat.get(t.categoryId)?.color ?? null : null,
        accountName: t.accountId ? accName.get(t.accountId) ?? null : null,
      })),
    };
  }
}
