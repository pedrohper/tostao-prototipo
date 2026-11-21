// Busca instantânea da Carteira (T4.4): filtra o extrato do mês já carregado enquanto a pessoa digita.
// A busca em TODOS os meses continua em /carteira/busca (Enter na barra).

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pedaços da busca: só letras e números, sem acento, sem repetir. "  Pizza  do Zé!" → ["pizza","do","ze"]. */
export function searchTokens(query: string): string[] {
  const parts = norm(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [...new Set(parts)].slice(0, 6);
}

export type SearchableTx = {
  description: string;
  customDescription?: string | null;
  categoryName?: string | null;
  accountName?: string | null;
  note?: string | null;
};

/** Todas as palavras precisam aparecer (E) em algum campo: descrição, apelido, categoria, conta ou nota. */
export function matchesQuery(tx: SearchableTx, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = norm(
    [tx.description, tx.customDescription, tx.categoryName, tx.accountName, tx.note].filter(Boolean).join(' '),
  );
  return tokens.every((t) => haystack.includes(t));
}

/** Valor de `?q=` vindo da URL: aparado e limitado (nunca confia no tamanho). */
export function cleanQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Nova query string da Carteira com `q` trocado (ou removido, se vazio), preservando o resto. */
export function withQuery(params: URLSearchParams | string, q: string): string {
  const next = new URLSearchParams(typeof params === 'string' ? params : params.toString());
  const clean = cleanQuery(q);
  if (clean) next.set('q', clean);
  else next.delete('q');
  const str = next.toString();
  return str ? `?${str}` : '?';
}
