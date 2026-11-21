'use server';
import { searchQuery, type SearchResponse, type TransactionDTO } from '@tostao/contracts';
import { api, ApiError } from '@/lib/api';
import { rethrowIfRedirect } from '@/lib/rethrow';

export type LoadMoreResult = { transactions: TransactionDTO[]; nextCursor: string | null } | { error: string };

/**
 * "Carregar mais" da busca: a próxima página (por cursor). Server Action é um endpoint público, então o que chega
 * passa pelo MESMO schema da API (`searchQuery`); a API ainda confere o cursor e só devolve lançamentos da pessoa logada.
 */
export async function loadMoreSearch(input: {
  q: string;
  period: string;
  kind: string;
  excludeTransfers: boolean;
  excludeYields: boolean;
  cursor: string;
}): Promise<LoadMoreResult> {
  const parsed = searchQuery.safeParse(input);
  if (!parsed.success || !parsed.data.cursor) return { error: 'invalid' };
  const { q, period, kind, excludeTransfers, excludeYields, cursor, limit } = parsed.data;
  const params = new URLSearchParams({ q, period, kind, cursor, limit: String(limit) });
  if (excludeTransfers) params.set('excludeTransfers', '1');
  if (excludeYields) params.set('excludeYields', '1');
  try {
    const r = await api<SearchResponse>(`/transactions/search?${params}`);
    return { transactions: r.transactions, nextCursor: r.nextCursor };
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: e instanceof ApiError ? e.message : 'error' };
  }
}
