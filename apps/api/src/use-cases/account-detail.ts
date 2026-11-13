import { cardIdentity } from './card-identity.js';
import type { AccountDetailResponse } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { monthRange } from '../lib/month.js';
import { nextDueDate } from './get-month-summary.js';
import { installmentsInMonth, pendingInstallments, shiftMonth } from './financial-plan.js';
import { currentMonth } from '../lib/month.js';

const HISTORY = 6;

/**
 * Tudo de uma conta ou cartão num mês: o que entrou e saiu, por categoria, os últimos 6 meses
 * e, no cartão, as parcelas que ainda vão cair. Transferência interna aparece na lista mas não soma.
 */
export class AccountDetailUseCase {
  constructor(private readonly repos: Pick<Repositories, 'accounts' | 'connections' | 'transactions' | 'categories'>, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId, accountId, month }: { userId: string; accountId: string; month: string }): Promise<AccountDetailResponse> {
    const accounts = await this.repos.accounts.listByUser(userId);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new ResourceNotFoundError('Conta');
    const now = this.now();
    const first = shiftMonth(month, -(HISTORY - 1));
    const cur = currentMonth(now);
    const [all, categories, connection] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, monthRange(first).from, monthRange(month > cur ? month : cur).to),
      this.repos.categories.list(userId),
      this.repos.connections.findById(account.connectionId),
    ]);
    const txs = all.filter((t) => t.accountId === accountId);
    const cat = new Map(categories.map((c) => [c.id, c]));
    const monthOf = (d: Date) => currentMonth(d);

    const history = Array.from({ length: HISTORY }, (_, i) => ({ month: shiftMonth(first, i), outInCents: 0, inInCents: 0 }));
    const idx = new Map(history.map((h, i) => [h.month, i]));
    const byCat = new Map<string | null, number>();
    for (const t of txs) {
      if (t.isInternalTransfer || t.amountInCents === 0) continue;
      const m = monthOf(t.occurredAt);
      const h = idx.has(m) ? history[idx.get(m)!]! : null;
      if (!h) continue;
      if (t.amountInCents < 0) h.outInCents -= t.amountInCents; else h.inInCents += t.amountInCents;
      if (m === month && t.amountInCents < 0) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) - t.amountInCents);
    }
    const sel = history[history.length - 1]!;

    const card = account.type === 'CREDIT';
    const pending = card ? pendingInstallments(txs, new Set([accountId])) : [];
    const transactions = txs
      .filter((t) => monthOf(t.occurredAt) === month)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .map((t) => {
        const c = t.categoryId ? cat.get(t.categoryId) : undefined;
        return {
          id: t.id, description: t.description, amountInCents: t.amountInCents, occurredAt: t.occurredAt.toISOString(),
          categoryId: t.categoryId, categoryName: c?.name ?? null, categoryEmoji: c?.emoji ?? null, categoryColor: c?.color ?? null,
          accountName: account.name, isInternalTransfer: t.isInternalTransfer, source: t.externalId ? 'bank' as const : 'manual' as const, seriesId: t.seriesId ?? null, personId: t.personId ?? null,
        };
      });

    return {
      account: {
        id: account.id, name: account.name, type: account.type, institution: connection?.institution ?? null,
        balanceInCents: account.balanceInCents, creditLimitInCents: account.creditLimitInCents ?? null,
        dueDate: account.dueDate ? nextDueDate(account.dueDate, now).toISOString() : null,
        lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null, hidden: account.hidden,
        ...cardIdentity(account.fingerprint),
      },
      month,
      outInCents: sel.outInCents,
      inInCents: sel.inInCents,
      byCategory: [...byCat.entries()]
        .map(([categoryId, totalInCents]) => ({
          categoryId, totalInCents,
          name: categoryId ? cat.get(categoryId)?.name ?? categoryId : 'Sem categoria',
          color: categoryId ? cat.get(categoryId)?.color ?? '#F6EFE4' : '#F6EFE4',
        }))
        .sort((a, b) => b.totalInCents - a.totalInCents),
      history,
      transactions,
      installments: pending
        .map((i) => {
          const passed = Math.max(0, (Number(cur.slice(0, 4)) - Number(i.month.slice(0, 4))) * 12 + Number(cur.slice(5)) - Number(i.month.slice(5)));
          const n = Math.min(i.total, i.n + passed);
          return { description: i.description.replace(/\s*\d{1,2}\s*\/\s*\d{1,2}\s*/, ' ').trim(), amountInCents: i.amount, n, total: i.total, left: i.total - n };
        })
        .filter((i) => i.left > 0)
        .sort((a, b) => b.amountInCents * b.left - a.amountInCents * a.left),
      upcoming: card ? [1, 2, 3].map((k) => ({ month: shiftMonth(cur, k), amountInCents: installmentsInMonth(pending, shiftMonth(cur, k)) })) : [],
    };
  }
}
