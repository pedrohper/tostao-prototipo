import { cookies } from 'next/headers';

/** O que a pessoa escondeu do Início (blocos) e os avisos que ela já fechou. Fica num cookie, por aparelho. */
export const PREFS_COOKIE = 'tostao-inicio';
export type InicioPrefs = { ordem: string[]; ocultos: string[]; fechados: string[] };

/** Blocos do Início que dá pra esconder e reordenar, na ordem padrão. O saldo fica sempre no topo. */
export const SECOES = [
  { id: 'sobra', nome: 'Quanto sobra no mês', dica: 'Previsão até o fim do mês' },
  { id: 'missoes', nome: 'Missões de hoje', dica: 'E a sua ofensiva' },
  { id: 'vence', nome: 'Vence logo', dica: 'Contas, assinaturas e faturas' },
  { id: 'avisos', nome: 'Avisos do Tostão e do Caramelo', dica: 'Dicas e gastos sem categoria' },
  { id: 'pra-onde-foi', nome: 'Pra onde foi', dica: 'Gastos por categoria' },
  { id: 'semana', nome: 'Sua semana', dica: 'Últimos 7 dias' },
  { id: 'meta', nome: 'Meta', dica: 'Quanto falta pra sua meta' },
  { id: 'cartoes', nome: 'Cartões de crédito', dica: 'Fatura e limite' },
  { id: 'limites', nome: 'Limites', dica: 'Teto por categoria' },
] as const;
export type SecaoId = (typeof SECOES)[number]['id'];

export function parsePrefs(raw: string | undefined): InicioPrefs {
  try {
    const p = JSON.parse(raw ?? '{}') as Partial<InicioPrefs>;
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string').slice(-80) : []);
    return { ordem: list(p.ordem), ocultos: list(p.ocultos), fechados: list(p.fechados) };
  } catch {
    return { ordem: [], ocultos: [], fechados: [] };
  }
}

export async function lerPrefs() {
  return parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
}

/** Ordem final: a que a pessoa escolheu, com blocos novos no fim. */
export function ordemDe(p: InicioPrefs): SecaoId[] {
  const ids = SECOES.map((x) => x.id) as SecaoId[];
  const escolhidos = p.ordem.filter((id): id is SecaoId => (ids as string[]).includes(id));
  return [...escolhidos, ...ids.filter((id) => !escolhidos.includes(id))];
}
