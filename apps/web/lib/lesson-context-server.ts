// Busca os dados da pessoa pra personalizar uma lição (T4.5). Só roda no servidor (usa `api`).
// Qualquer falha vira `null` naquele dado: a lição NUNCA quebra por falta de extrato, de plano ou de API.
import type { FinancialPlanResponse, MonthSummaryResponse, SubscriptionsResponse } from '@tostao/contracts';
import { api } from './api';
import { currentMonth, shiftMonth } from './format';
import { LESSONS_WITH_CONTEXT, buildLessonContext, type LessonUserContext } from './lesson-context';

const empty = (s: MonthSummaryResponse | null) => !s || (s.incomeInCents === 0 && s.outcomeInCents === 0);

export async function loadLessonContext(lessonId: string): Promise<LessonUserContext | null> {
  if (!LESSONS_WITH_CONTEXT.has(lessonId)) return null;
  const month = currentMonth();
  const [current, plan, subscriptions] = await Promise.all([
    api<MonthSummaryResponse>(`/summary?month=${month}`).catch(() => null),
    api<FinancialPlanResponse>('/plan').catch(() => null),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
  ]);
  // Começo de mês sem movimento: usa o mês passado inteiro em vez de mostrar zeros.
  let summary = current;
  let used = month;
  if (empty(current)) {
    const prevMonth = shiftMonth(month, -1);
    const prev = await api<MonthSummaryResponse>(`/summary?month=${prevMonth}`).catch(() => null);
    if (!empty(prev)) {
      summary = prev;
      used = prevMonth;
    }
  }
  return buildLessonContext({
    month: used,
    currentMonth: month,
    summary,
    plan: plan?.plan ?? null,
    subscriptions,
  });
}
