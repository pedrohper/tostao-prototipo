import type { Repositories } from '../repositories/types.js';
import { monthRange } from '../lib/month.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';

type Deps = Pick<Repositories, 'budgets' | 'categories' | 'transactions'>;

/** Limites do mês: quanto você se deu de teto em cada categoria e quanto já foi. */
export class GetBudgetsUseCase {
  constructor(private readonly repos: Deps) {}

  async execute({ userId, month }: { userId: string; month: string }) {
    const { from, to } = monthRange(month);
    const [budgets, categories, txs] = await Promise.all([
      this.repos.budgets.listByUser(userId),
      this.repos.categories.list(),
      this.repos.transactions.findManyInRange(userId, from, to),
    ]);
    const spent = new Map<string, number>();
    for (const t of txs) {
      if (t.isInternalTransfer || t.amountInCents >= 0 || !t.categoryId) continue;
      spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) - t.amountInCents);
    }
    const byId = new Map(categories.map((c) => [c.id, c]));
    return {
      budgets: budgets
        .filter((b) => byId.has(b.categoryId))
        .map((b) => {
          const c = byId.get(b.categoryId)!;
          return { categoryId: c.id, name: c.name, emoji: c.emoji, color: c.color, limitInCents: b.limitInCents, spentInCents: spent.get(c.id) ?? 0 };
        })
        .sort((a, b) => b.spentInCents / b.limitInCents - a.spentInCents / a.limitInCents),
    };
  }
}

/** Define (ou tira, com null) o teto de uma categoria de gasto. */
export class SetBudgetUseCase {
  constructor(private readonly repos: Pick<Repositories, 'budgets' | 'categories'>) {}

  async execute({ userId, categoryId, limitInCents }: { userId: string; categoryId: string; limitInCents: number | null }) {
    const category = await this.repos.categories.findById(categoryId);
    if (!category) throw new ResourceNotFoundError('Categoria');
    if (category.kind !== 'saida') throw new AppError('Limite só faz sentido pra categoria de gasto.', 400);
    if (limitInCents === null) {
      await this.repos.budgets.delete(userId, categoryId);
      return { removed: true };
    }
    await this.repos.budgets.upsert({ userId, categoryId, limitInCents });
    return { removed: false };
  }
}
