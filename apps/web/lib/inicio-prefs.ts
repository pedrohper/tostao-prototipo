import { cookies } from 'next/headers';

/** Cookie storing hidden Home sections and dismissed alerts per device. */
export const PREFS_COOKIE = 'tostao-inicio';
export type HomePrefs = { ordem: string[]; ocultos: string[]; fechados: string[] };

/** Home sections that can be hidden and reordered, in default order. Balance stays on top. */
export const HOME_SECTIONS = [
  { id: 'evolucao', nome: 'Mês a mês', dica: 'O que entrou e saiu nos últimos meses' },
  { id: 'atalhos', nome: 'Atalhos do Planejar', dica: 'Anotar, Acertos, Limites, Meta e mais' },
  { id: 'aula', nome: 'Aula do Tostão', dica: 'Continuar a lição do módulo atual' },
  { id: 'sobra', nome: 'Quanto sobra no mês', dica: 'Previsão até o fim do mês' },
  { id: 'vence', nome: 'Vence logo', dica: 'Contas, assinaturas e faturas' },
  { id: 'avisos', nome: 'Avisos do Tostão e do Caramelo', dica: 'Dicas e gastos sem categoria' },
  { id: 'pra-onde-foi', nome: 'Gastos por categoria', dica: 'Resumo do mês por categoria' },
  { id: 'semana', nome: 'Sua semana', dica: 'Comparativo semanal' },
  { id: 'meta', nome: 'Meta', dica: 'Quanto falta pra sua meta' },
  { id: 'acertos', nome: 'Acertos', dica: 'Quem te deve e pra quem você deve' },
  { id: 'cartoes', nome: 'Cartões de crédito', dica: 'Fatura e limite' },
  { id: 'limites', nome: 'Limites', dica: 'Teto por categoria' },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['id'];

/**
 * T4.3 · Home enxuta: quem nunca personalizou vê só o essencial (evolução, avisos, pra onde foi, limites, previsão,
 * meta e aula). O resto continua a um toque em /inicio/personalizar.
 */
export const DEFAULT_HIDDEN_SECTIONS: readonly HomeSectionId[] = ['atalhos', 'vence', 'semana', 'acertos', 'cartoes'];

export function parsePrefs(raw: string | undefined): HomePrefs {
  try {
    const parsed = JSON.parse(raw ?? '{}') as Partial<HomePrefs>;
    const toList = (val: unknown) =>
      Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string').slice(-80) : [];
    // Sem a chave `ocultos` (nunca personalizou) vale o padrão enxuto; com a chave (mesmo vazia) vale a escolha da pessoa.
    const ocultos = Array.isArray(parsed.ocultos) ? toList(parsed.ocultos) : [...DEFAULT_HIDDEN_SECTIONS];
    return { ordem: toList(parsed.ordem), ocultos, fechados: toList(parsed.fechados) };
  } catch {
    return { ordem: [], ocultos: [...DEFAULT_HIDDEN_SECTIONS], fechados: [] };
  }
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
