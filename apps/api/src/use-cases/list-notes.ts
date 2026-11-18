import type { Repositories } from '../repositories/types.js';
import { presentTransaction } from '../http/presenters.js';

const CONFIRMED_LIMIT = 100;

/**
 * Tela "Anotações": tudo que a pessoa anotou à mão e continua valendo, mais o histórico do que o app
 * apagou sozinho porque o banco já trouxe a cobrança real.
 */
export class ListNotesUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts' | 'reconciledNotes'>,
  ) {}

  async execute({ userId }: { userId: string }) {
    const [manual, categories, accounts, confirmed] = await Promise.all([
      this.repos.transactions.findManualByUser(userId),
      this.repos.categories.list(userId),
      this.repos.accounts.listByUser(userId),
      this.repos.reconciledNotes.listByUser(userId, CONFIRMED_LIMIT),
    ]);
    const cat = new Map(categories.map((c) => [c.id, c]));
    const accName = new Map(accounts.map((a) => [a.id, a.name]));
    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));

    return {
      entries: manual
        .filter((t) => !(t.accountId && hidden.has(t.accountId)))
        .map((t) =>
          presentTransaction({
            ...t,
            categoryName: t.categoryId ? (cat.get(t.categoryId)?.name ?? null) : null,
            categoryEmoji: t.categoryId ? (cat.get(t.categoryId)?.emoji ?? null) : null,
            categoryColor: t.categoryId ? (cat.get(t.categoryId)?.color ?? null) : null,
            accountName: t.accountId ? (accName.get(t.accountId) ?? null) : null,
          }),
        ),
      confirmed: confirmed.map((n) => ({
        id: n.id,
        description: n.description,
        amountInCents: n.amountInCents,
        occurredAt: n.occurredAt.toISOString(),
        note: n.note,
        categoryName: n.categoryId ? (cat.get(n.categoryId)?.name ?? null) : null,
        categoryEmoji: n.categoryId ? (cat.get(n.categoryId)?.emoji ?? null) : null,
        bankTransactionId: n.bankTransactionId,
        bankDescription: n.bankDescription,
        reconciledAt: n.reconciledAt.toISOString(),
      })),
    };
  }
}
