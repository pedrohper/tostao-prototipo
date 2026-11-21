import { SEARCH_DEFAULT_LIMIT, type SearchQuery } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { AppError } from '../domain/errors.js';
import { searchWords } from '../lib/text.js';
import { decodeSearchCursor, encodeSearchCursor } from '../lib/search-cursor.js';

const DAY = 24 * 60 * 60 * 1000;
const SINCE: Record<SearchQuery['period'], number | null> = { '30d': 30, '3m': 92, '12m': 366, tudo: null };

/**
 * Busca de transação: "ifood", "dani", "uber nubank". Cada palavra tem que aparecer na descrição, na categoria ou no
 * nome do banco (sem diferenciar maiúscula; acento vale). Soma o que achou, que é a resposta de "quanto já mandei pra
 * fulano?". Transferência interna aparece na lista mas não entra na soma.
 *
 * Quem filtra, ordena, pagina e soma é o Postgres (`transactions.search`): a pessoa com 5 anos de histórico não carrega
 * tudo na memória a cada busca. A lista vem em páginas (`limit` + `nextCursor`); o total e as somas são do resultado todo.
 */
export class SearchTransactionsUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({
    userId,
    q,
    period,
    kind,
    categoryId,
    excludeTransfers,
    excludeYields,
    limit = SEARCH_DEFAULT_LIMIT,
    cursor,
  }: Omit<SearchQuery, 'limit'> & { userId: string; limit?: number }) {
    const now = this.now();
    const days = SINCE[period];
    const decoded = cursor ? decodeSearchCursor(cursor) : undefined;
    if (cursor && !decoded) throw new AppError('Esse "carregar mais" não vale mais. Faz a busca de novo.', 400);

    const [result, categories, accounts] = await Promise.all([
      this.repos.transactions.search(userId, {
        from: days === null ? null : new Date(now.getTime() - days * DAY),
        to: new Date(now.getTime() + DAY),
        words: searchWords(q),
        kind,
        categoryId,
        excludeTransfers,
        excludeYields,
        limit,
        cursor: decoded ?? undefined,
      }),
      this.repos.categories.list(userId),
      this.repos.accounts.listByUser(userId),
    ]);
    const cat = new Map(categories.map((c) => [c.id, c]));
    const accName = new Map(accounts.map((a) => [a.id, a.name]));
    return {
      count: result.count,
      outInCents: result.outInCents,
      inInCents: result.inInCents,
      nextCursor: result.nextCursor ? encodeSearchCursor(result.nextCursor) : null,
      transactions: result.transactions.map((t) => ({
        ...t,
        categoryName: t.categoryId ? (cat.get(t.categoryId)?.name ?? null) : null,
        categoryEmoji: t.categoryId ? (cat.get(t.categoryId)?.emoji ?? null) : null,
        categoryColor: t.categoryId ? (cat.get(t.categoryId)?.color ?? null) : null,
        accountName: t.accountId ? (accName.get(t.accountId) ?? null) : null,
      })),
    };
  }
}
