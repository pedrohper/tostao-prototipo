import type { Repositories } from '../repositories/types.js';
import { monthRange } from '../lib/month.js';

/**
 * Resumo do mês pra tela de Início.
 * Regra de ouro: transferência interna não é gasto nem renda.
 */
export class GetMonthSummaryUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts'>) {}

  async execute({ userId, month }: { userId: string; month: string }) {
    const { from, to } = monthRange(month);
    const [txs, categories, accounts] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, from, to),
      this.repos.categories.list(),
      this.repos.accounts.listByUser(userId),
    ]);
    const real = txs.filter((t) => !t.isInternalTransfer);

    const incomeInCents = real.filter((t) => t.amountInCents > 0).reduce((s, t) => s + t.amountInCents, 0);
    const outs = real.filter((t) => t.amountInCents < 0);
    const outcomeInCents = outs.reduce((s, t) => s - t.amountInCents, 0);

    const totals = new Map<string | null, number>();
    for (const t of outs) totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) - t.amountInCents);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const byCategory = [...totals.entries()]
      .map(([categoryId, totalInCents]) => ({
        categoryId,
        name: categoryId ? byId.get(categoryId)?.name ?? categoryId : 'Sem categoria',
        color: categoryId ? byId.get(categoryId)?.color ?? '#F6EFE4' : '#F6EFE4',
        totalInCents,
      }))
      .sort((a, b) => b.totalInCents - a.totalInCents);

    // Saldo = soma das contas correntes. Fatura de cartão fica de fora (ainda não saiu da conta).
    const bankAccounts = accounts.filter((a) => a.type === 'BANK');
    return {
      month,
      balanceInCents: bankAccounts.length ? bankAccounts.reduce((s, a) => s + a.balanceInCents, 0) : null,
      incomeInCents,
      outcomeInCents,
      uncategorizedCount: real.filter((t) => t.categoryId === null).length,
      byCategory,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, balanceInCents: a.balanceInCents })),
    };
  }
}
