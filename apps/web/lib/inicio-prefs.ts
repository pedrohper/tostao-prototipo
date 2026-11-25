import { cookies } from 'next/headers';

/** Cookie storing hidden Home sections and dismissed alerts per device. */
export const PREFS_COOKIE = 'tostao-inicio';
export type HomePrefs = { ordem: string[]; ocultos: string[]; fechados: string[]; v?: number };

/** Home sections that can be hidden and reordered, in default order. Balance stays on top. */
export const HOME_SECTIONS = [
  { id: 'atalhos', nome: 'Atalhos do Planejar', dica: 'Anotações, Acertos, Limites, Meta e mais' },
  { id: 'pendencias', nome: 'Pendências e alertas', dica: 'Despesas a pagar e receitas a receber' },
  { id: 'evolucao', nome: 'Mês a mês', dica: 'O que entrou e saiu nos últimos meses' },
  { id: 'sobra', nome: 'Quanto sobra no mês', dica: 'Previsão até o fim do mês' },
  { id: 'vence', nome: 'Vence logo', dica: 'Contas, assinaturas e faturas' },
  { id: 'avisos', nome: 'Avisos do Tostão e do Caramelo', dica: 'Dicas e gastos sem categoria' },
  { id: 'pra-onde-foi', nome: 'Gastos por categoria', dica: 'Resumo do mês por categoria' },
  { id: 'aula', nome: 'Aula do Tostão', dica: 'Continuar a lição do módulo atual' },
  { id: 'semana', nome: 'Sua semana', dica: 'Comparativo semanal' },
  { id: 'meta', nome: 'Meta', dica: 'Quanto falta pra sua meta' },
  { id: 'acertos', nome: 'Acertos', dica: 'Quem te deve e pra quem você deve' },
  { id: 'cartoes', nome: 'Cartões de crédito', dica: 'Fatura e limite' },
  { id: 'limites', nome: 'Limites', dica: 'Teto por categoria' },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['id'];

/**
 * T6.10 · Home enxuta: quem nunca personalizou vê só o saldo do mês (sempre no topo), os avisos, pra onde foi o dinheiro
 * e a próxima lição. O resto continua a um toque em /inicio/personalizar.
 */
const DEFAULT_VISIBLE_SECTIONS: readonly HomeSectionId[] = ['avisos', 'pra-onde-foi', 'aula'];
export const DEFAULT_HIDDEN_SECTIONS: readonly HomeSectionId[] = HOME_SECTIONS.map((s) => s.id).filter(
  (id) => !DEFAULT_VISIBLE_SECTIONS.includes(id),
);

/**
 * Padrões antigos que ficaram "congelados" em cookie: fechar um aviso gravava o padrão da época como se fosse escolha.
 */
const FROZEN_DEFAULTS: readonly (readonly string[])[] = [
  ['atalhos', 'vence', 'semana', 'acertos', 'cartoes'], // T4.3
  ['vence', 'semana', 'acertos', 'cartoes'], // até a T6.10
];

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * A pessoa escolheu a própria Home? Quem salvou pela tela Personalizar tem `v: 2` ou uma ordem gravada. Sem nada disso,
 * uma lista igual a um padrão (de hoje ou antigo) não é escolha.
 */
function isCustomized({ ordem, ocultos, v }: Pick<HomePrefs, 'ordem' | 'ocultos' | 'v'>) {
  if (v === 2 || ordem.length > 0) return true;
  return ![DEFAULT_HIDDEN_SECTIONS, ...FROZEN_DEFAULTS].some((defaults) => sameIds(ocultos, defaults));
}

export function parsePrefs(raw: string | undefined): HomePrefs {
  try {
    const parsed = JSON.parse(raw ?? '{}') as Partial<HomePrefs>;
    const toList = (val: unknown) =>
      Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string').slice(-80) : [];
    const ordem = toList(parsed.ordem);
    const fechados = toList(parsed.fechados);
    const v = typeof parsed.v === 'number' ? parsed.v : undefined;
    // Sem a chave `ocultos` (nunca personalizou) vale o padrão; com a chave (mesmo vazia) vale a escolha da pessoa,
    // a não ser que seja só um padrão congelado.
    const stored = Array.isArray(parsed.ocultos) ? toList(parsed.ocultos) : null;
    const ocultos = stored && isCustomized({ ordem, ocultos: stored, v }) ? stored : [...DEFAULT_HIDDEN_SECTIONS];
    return { ordem, ocultos, fechados, ...(v !== undefined ? { v } : {}) };
  } catch {
    return { ordem: [], ocultos: [...DEFAULT_HIDDEN_SECTIONS], fechados: [] };
  }
}

/** O que vai pro cookie. Quem nunca personalizou não leva `ocultos`: assim um padrão novo também vale pra essa pessoa. */
export function serializePrefs(prefs: HomePrefs): string {
  if (isCustomized(prefs)) return JSON.stringify(prefs);
  const { ocultos: _padrao, ...rest } = prefs;
  return JSON.stringify(rest);
}

export async function readHomePrefs(): Promise<HomePrefs> {
  return parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
}

/** Returns user's chosen section order with any newly added sections appended at the end. */
export function resolveSectionOrder(prefs: HomePrefs): HomeSectionId[] {
  const allIds = HOME_SECTIONS.map((s) => s.id) as HomeSectionId[];
  const selected = prefs.ordem.filter((id): id is HomeSectionId => (allIds as string[]).includes(id));
  return [...selected, ...allIds.filter((id) => !selected.includes(id))];
}
