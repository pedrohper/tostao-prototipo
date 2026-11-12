import type { SearchQuery } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { normalizeDescription } from '../lib/text.js';

const DAY = 24 * 60 * 60 * 1000;
const SINCE: Record<SearchQuery['period'], number | null> = { '30d': 30, '3m': 92, '12m': 366, tudo: null };
const LIMIT = 200;

/**
 * Busca de transação: "ifood", "dani", "uber nubank". Cada palavra tem que aparecer na descrição,
 * na categoria ou no nome do banco (sem acento, sem maiúscula). Soma o que achou, que é a resposta
 * de "quanto já mandei pra fulano?". Transferência interna aparece na lista mas não entra na soma.
 */
export class SearchTransactionsUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts'>, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId, q, period, kind, categoryId }: SearchQuery & { userId: string }) {
    const now = this.now();
    const days = SINCE[period];
    const from = days === null ? new Date(0) : new Date(now.getTime() - days * DAY);
    const [txs, categories, accounts] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, from, new Date(now.getTime() + DAY)),
      this.repos.categories.list(userId),
      this.repos.accounts.listByUser(userId),
    ]);
    const cat = new Map(categories.map((c) => [c.id, c]));
    const accName = new Map(accounts.map((a) => [a.id, a.name]));
    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
    const words = normalizeDescription(q).split(' ').filter(Boolean);

    const found = txs
      .filter((t) => !(t.accountId && hidden.has(t.accountId)))
      .filter((t) => (kind === 'saida' ? t.amountInCents < 0 : kind === 'entrada' ? t.amountInCents > 0 : true))
      .filter((t) => !categoryId || (categoryId === 'sem' ? !t.categoryId : t.categoryId === categoryId))
      .filter((t) => {
        if (!words.length) return true;
        const hay = normalizeDescription(`${t.description} ${t.categoryId ? cat.get(t.categoryId)?.name ?? '' : ''} ${t.accountId ? accName.get(t.accountId) ?? '' : ''}`);
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const counted = found.filter((t) => !t.isInternalTransfer);
    return {
      count: found.length,
      outInCents: counted.filter((t) => t.amountInCents < 0).reduce((s, t) => s - t.amountInCents, 0),
      inInCents: counted.filter((t) => t.amountInCents > 0).reduce((s, t) => s + t.amountInCents, 0),
      transactions: found.slice(0, LIMIT).map((t) => ({
        ...t,
        categoryName: t.categoryId ? cat.get(t.categoryId)?.name ?? null : null,
        categoryEmoji: t.categoryId ? cat.get(t.categoryId)?.emoji ?? null : null,
        categoryColor: t.categoryId ? cat.get(t.categoryId)?.color ?? null : null,
        accountName: t.accountId ? accName.get(t.accountId) ?? null : null,
      })),
    };
  }
}
