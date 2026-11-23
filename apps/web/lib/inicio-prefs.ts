import { cookies } from 'next/headers';

/** Cookie storing hidden Home sections and dismissed alerts per device. */
export const PREFS_COOKIE = 'tostao-inicio';
export type HomePrefs = { ordem: string[]; ocultos: string[]; fechados: string[]; v?: number };

/** Home sections that can be hidden and reordered, in default order. Balance stays on top. */
export const HOME_SECTIONS = [
  { id: 'atalhos', nome: 'Atalhos do Planejar', dica: 'Anotações, Acertos, Limites, Meta e mais' },
  { id: 'pendencias', nome: 'Pendências e alertas', dica: 'Despesas a pagar e receitas a receber' },
  { id: 'evolucao', nome: 'Mês a mês', dica: 'O que entrou e saiu nos últimos meses' },
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

const LEGACY_T43_DEFAULTS = new Set(['atalhos', 'vence', 'semana', 'acertos', 'cartoes']);

/**
 * T4.3 · Home enxuta: quem nunca personalizou vê o essencial (incluindo o carrossel de atalhos). O resto continua a um
 * toque em /inicio/personalizar.
 */
export const DEFAULT_HIDDEN_SECTIONS: readonly HomeSectionId[] = ['vence', 'semana', 'acertos', 'cartoes'];

export function parsePrefs(raw: string | undefined): HomePrefs {
  try {
    const parsed = JSON.parse(raw ?? '{}') as Partial<HomePrefs>;
    const toList = (val: unknown) =>
      Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string').slice(-80) : [];
    const ordem = toList(parsed.ordem);
    const fechados = toList(parsed.fechados);
    // Sem a chave `ocultos` (nunca personalizou) vale o padrão; se o cookie veio do fluxo antigo (`v !== 2`) com a
    // lista exata do padrão T4.3 congelada ao dispensar alerta, devolve os atalhos pro usuário.
    let ocultos = Array.isArray(parsed.ocultos) ? toList(parsed.ocultos) : [...DEFAULT_HIDDEN_SECTIONS];
    if (
      parsed.v !== 2 &&
      ordem.length === 0 &&
      ocultos.length === LEGACY_T43_DEFAULTS.size &&
      ocultos.every((id) => LEGACY_T43_DEFAULTS.has(id))
    ) {
      ocultos = [...DEFAULT_HIDDEN_SECTIONS];
    }
    return { ordem, ocultos, fechados, ...(typeof parsed.v === 'number' ? { v: parsed.v } : {}) };
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
