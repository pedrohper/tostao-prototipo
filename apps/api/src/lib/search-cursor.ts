// Cursor da busca: aponta pro último lançamento da página (data + id), em base64url. É "keyset": a próxima página
// começa DEPOIS dele na ordem (occurredAt desc, id desc), então apagar ou inserir lançamentos entre as páginas não
// repete nem pula linha (o cursor por posição/offset faria).
export type SearchCursor = { occurredAt: Date; id: string };

export function encodeSearchCursor({ occurredAt, id }: SearchCursor): string {
  return Buffer.from(`${occurredAt.toISOString()}|${id}`).toString('base64url');
}

/** null se não for um cursor que a gente gerou (quem chama devolve 400). */
export function decodeSearchCursor(raw: string): SearchCursor | null {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const [iso, id, ...rest] = decoded.split('|');
  if (!iso || !id || rest.length) return null;
  const occurredAt = new Date(iso);
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.toISOString() !== iso) return null;
  if (!/^[0-9a-fA-F-]{8,64}$/.test(id)) return null;
  return { occurredAt, id };
}
