// Leituras da Home (T6.9). Cada bloco pede o próprio dado; o `cache()` do React junta os pedidos repetidos num só por
// render. Quem tem reserva usa `orFallback`: erro comum esconde só aquele bloco, mas o redirect de sessão vencida passa.
import { cache } from 'react';
import type {
  BudgetsResponse,
  ForecastResponse,
  FriendsResponse,
  MonthSummaryResponse,
  PeopleResponse,
  RemindersResponse,
  SubscriptionsResponse,
  SummaryHistoryResponse,
  WeeklyResponse,
} from '@tostao/contracts';
import { api } from '@/lib/api';
import { getMissions, getProgress, getTostaoAuto } from '@/lib/api-queries';
import type { HomeSectionId } from '@/lib/inicio-prefs';
import { orFallback } from '@/lib/rethrow';
import { startEarly } from '@/components/suspense';
import { NO_PROGRESS } from '@/lib/xp';

/** O essencial da tela (saldo, entrou/saiu, categorias). Sem reserva: se falhar, a tela de erro aparece. */
export const getSummary = cache((month: string) => api<MonthSummaryResponse>(`/summary?month=${month}`));

export const getBudgets = cache((month: string) =>
  api<BudgetsResponse>(`/budgets?month=${month}`).catch(orFallback<BudgetsResponse>({ budgets: [] })),
);
export const getSubscriptions = cache(() => api<SubscriptionsResponse>('/subscriptions').catch(orFallback(null)));
export const getForecast = cache(() => api<ForecastResponse>('/forecast').catch(orFallback(null)));
/** Evolução mensal (3 consultas pra 6 meses). Sem ela a Home só perde o gráfico. */
export const getHistory = cache((month: string) =>
  api<SummaryHistoryResponse>(`/summary/history?month=${month}&months=6`).catch(orFallback(null)),
);
export const getReminders = cache(() =>
  api<RemindersResponse>('/reminders').catch(orFallback<RemindersResponse>({ reminders: [] })),
);
export const getWeekly = cache(() => api<WeeklyResponse>('/weekly').catch(orFallback(null)));
export const getPeople = cache(() => api<PeopleResponse>('/people').catch(orFallback(null)));
export const getFriends = cache(() => api<FriendsResponse>('/friends').catch(orFallback(null)));

// Estes três o layout do app também pede (mesmo `cache()` lá embaixo): na Home não viram um segundo pedido.
export const getHomeProgress = cache(() => getProgress().catch(orFallback(NO_PROGRESS)));
export const getHomeMissions = cache(() => getMissions().catch(orFallback(null)));
export const getHomeAuto = cache(() => getTostaoAuto().catch(orFallback(null)));

/** O que cada seção vai pedir. Seção escondida não pede nada. */
const SECTION_DATA: Partial<Record<HomeSectionId, (month: string) => Promise<unknown>[]>> = {
  avisos: (month) => [getHomeAuto(), getBudgets(month), getSubscriptions()],
  evolucao: (month) => [getHistory(month)],
  sobra: () => [getForecast()],
  vence: () => [getReminders()],
  semana: () => [getWeekly()],
  meta: () => [getForecast()],
  acertos: () => [getPeople()],
  limites: (month) => [getBudgets(month)],
};

/**
 * Começa JÁ os pedidos das seções visíveis, sem esperar. Os blocos só são desenhados depois que o saldo chega; sem isto
 * as consultas deles começariam em fila, atrás dele.
 */
export function prefetchSections(sections: readonly HomeSectionId[], month: string) {
  for (const id of sections) for (const request of SECTION_DATA[id]?.(month) ?? []) void startEarly(request);
}
