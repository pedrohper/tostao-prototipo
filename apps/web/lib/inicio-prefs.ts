import { cookies } from 'next/headers';

/** Cookie storing hidden Home sections and dismissed alerts per device. */
export const PREFS_COOKIE = 'tostao-inicio';
export type HomePrefs = { ordem: string[]; ocultos: string[]; fechados: string[] };

/** Home sections that can be hidden and reordered, in default order. Balance stays on top. */
export const HOME_SECTIONS = [
  { id: 'sobra', nome: 'Quanto sobra no mês', dica: 'Previsão até o fim do mês' },
  { id: 'missoes', nome: 'Missões de hoje', dica: 'E a sua ofensiva' },
  { id: 'vence', nome: 'Vence logo', dica: 'Contas, assinaturas e faturas' },
  { id: 'avisos', nome: 'Avisos do Tostão e do Caramelo', dica: 'Dicas e gastos sem categoria' },
  { id: 'pra-onde-foi', nome: 'Pra onde foi', dica: 'Gastos por categoria' },
  { id: 'semana', nome: 'Sua semana', dica: 'Últimos 7 dias' },
  { id: 'meta', nome: 'Meta', dica: 'Quanto falta pra sua meta' },
  { id: 'acertos', nome: 'Acertos', dica: 'Quem te deve e pra quem você deve' },
  { id: 'cartoes', nome: 'Cartões de crédito', dica: 'Fatura e limite' },
  { id: 'limites', nome: 'Limites', dica: 'Teto por categoria' },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]['id'];

export function parsePrefs(raw: string | undefined): HomePrefs {
  try {
    const parsed = JSON.parse(raw ?? '{}') as Partial<HomePrefs>;
    const toList = (val: unknown) =>
      Array.isArray(val) ? val.filter((v): v is string => typeof v === 'string').slice(-80) : [];
    return { ordem: toList(parsed.ordem), ocultos: toList(parsed.ocultos), fechados: toList(parsed.fechados) };
  } catch {
    return { ordem: [], ocultos: [], fechados: [] };
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

