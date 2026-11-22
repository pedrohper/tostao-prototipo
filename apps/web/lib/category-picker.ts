import type { CategoryDTO } from '@tostao/contracts';

/** Acima disso a lista ganha a barra de busca (poucas categorias: a busca só ocuparia espaço). */
export const SEARCH_THRESHOLD = 10;

/** Cores suaves do design system pra "+ Criar categoria" (mesmos tons de fundo das categorias do sistema). */
export const SOFT_COLORS = [
  { id: 'rosa', hex: '#FFE1E7' },
  { id: 'amarelo', hex: '#FFF1C7' },
  { id: 'menta', hex: '#DDF6E8' },
  { id: 'azul', hex: '#DCEBFF' },
  { id: 'bege', hex: '#F6EFE4' },
  { id: 'laranja', hex: '#FFE3D6' },
] as const;

export type SoftColorId = (typeof SOFT_COLORS)[number]['id'];

/** Minúsculas e sem acento: "Saúde" e "saude" são a mesma busca. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Filtra pelo nome (contém, sem acento nem maiúscula). Busca vazia devolve a lista inteira. */
export function filterCategories(list: CategoryDTO[], query: string): CategoryDTO[] {
  const q = normalizeSearch(query);
  if (!q) return list;
  return list.filter((c) => normalizeSearch(c.name).includes(q));
}

/** Junta as categorias do servidor com as criadas aqui (sem repetir id). As do servidor mandam se houver conflito. */
export function mergeCategories(base: CategoryDTO[], created: CategoryDTO[]): CategoryDTO[] {
  const ids = new Set(base.map((c) => c.id));
  return [...base, ...created.filter((c) => !ids.has(c.id))];
}

/**
 * O que a lista mostra: as do tipo (saída/entrada) e, se pedido, a neutra ("Não conta"), que sempre vai pro fim.
 * A ordem das demais é a que veio (sistema primeiro, depois as da pessoa).
 */
export function visibleCategories(
  list: CategoryDTO[],
  kind: 'saida' | 'entrada',
  includeNeutral: boolean,
): CategoryDTO[] {
  const doTipo = list.filter((c) => c.kind === kind);
  return includeNeutral ? [...doTipo, ...list.filter((c) => c.kind === 'neutra')] : doTipo;
}

export type NewCategoryInput = { name: string; kind: 'saida' | 'entrada'; color: string };
export type CreateResult = { category?: CategoryDTO; error?: string };

export type CreateOutcome =
  | { status: 'selected'; category: CategoryDTO }
  /** Criou, mas é de outro tipo (ex.: entrada enquanto anota uma saída): existe, só não serve pra este lançamento. */
  | { status: 'other-kind'; category: CategoryDTO }
  | { status: 'error'; message: string };

/**
 * "+ Criar categoria": chama a criação (POST /categories) e diz o que fazer com o resultado. Nunca lança: erro de rede
 * ou da API vira `{ status: 'error' }` pra a tela mostrar sem perder o que a pessoa já preencheu.
 */
export async function createAndClassify(
  onCreate: (input: NewCategoryInput) => Promise<CreateResult>,
  input: NewCategoryInput,
  listKind: 'saida' | 'entrada',
  fallbackError: string,
): Promise<CreateOutcome> {
  try {
    const r = await onCreate({ ...input, name: input.name.trim() });
    if (r.error || !r.category) return { status: 'error', message: r.error ?? fallbackError };
    return { status: r.category.kind === listKind ? 'selected' : 'other-kind', category: r.category };
  } catch {
    return { status: 'error', message: fallbackError };
  }
}

/** Enter num campo do seletor não pode enviar o formulário de fora (Salvar/Anotar): barra o envio e, se pedido, age. */
export function swallowEnter(e: { key: string; preventDefault: () => void }, then?: () => void): void {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  then?.();
}
