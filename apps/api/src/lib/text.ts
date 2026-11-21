// "Ifd*Açaí  do Zé" -> "IFD*ACAI DO ZE". Base pra comparar descrições de extrato.
export function normalizeDescription(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Palavras de uma busca: minúsculas, só letras e números (o resto vira separador) e no máximo 8.
 * Mantém os acentos digitados: o banco compara com ILIKE (acelerado por pg_trgm), que não ignora acento.
 */
export function searchWords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 8);
}
