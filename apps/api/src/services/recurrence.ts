// Datas e identidade das recorrências (T5.2). Funções puras: quem grava é o job (jobs/recurring.ts).
// Tudo em DIA CIVIL da pessoa (fuso dela), sempre ao meio-dia (noonOfCivilDay): nunca pula de dia por causa do fuso.
import type { RecurringRule } from '../domain/entities.js';
import { addCivilDays, civilDay, daysInMonth, noonOfCivilDay } from '../lib/tz.js';

type Cadence = Pick<RecurringRule, 'frequency' | 'dayOfMonth'>;

/** Soma `n` meses a um mês 'AAAA-MM'. */
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** Dia 31 num mês de 30 dias cai no último dia do mês (e 29/30/31 em fevereiro, idem). */
export function dayInMonth(month: string, dayOfMonth: number): string {
  return `${month}-${String(Math.min(dayOfMonth, daysInMonth(month))).padStart(2, '0')}`;
}

/** Próximo vencimento depois de `day` (AAAA-MM-DD). Mensal usa SEMPRE o dia fixo da regra (31 não "escorrega" depois de fevereiro). */
export function nextDay(rule: Cadence, day: string): string {
  if (rule.frequency === 'WEEKLY') return addCivilDays(day, 7);
  if (rule.frequency === 'BIWEEKLY') return addCivilDays(day, 14);
  return dayInMonth(shiftMonth(day.slice(0, 7), 1), rule.dayOfMonth);
}

/** O instante em que a regra vence (meio-dia do dia civil, no fuso da pessoa). */
export const dueAt = (day: string, tz: string) => noonOfCivilDay(day, tz);

/**
 * Chave do lançamento gerado. Mensal: `rec:<regra>:<AAAA-MM>` (como o doc pede); semanal/quinzenal tem mais de um
 * vencimento por mês, então usa o dia inteiro. Mesma regra + mesmo período = mesma chave = o banco barra a duplicata.
 */
export function recurringExternalId(rule: Pick<RecurringRule, 'id' | 'frequency'>, day: string): string {
  return `rec:${rule.id}:${rule.frequency === 'MONTHLY' ? day.slice(0, 7) : day}`;
}

/** "Netflix" ou, parcelado, "Notebook (3/12)". */
export function occurrenceDescription(
  rule: Pick<RecurringRule, 'description' | 'totalInstallments'>,
  n: number,
): string {
  return rule.totalInstallments ? `${rule.description} (${n}/${rule.totalInstallments})` : rule.description;
}

/** Vencimentos da regra dentro de um mês 'AAAA-MM' (a previsão usa pra olhar pra frente). `n` = número da parcela. */
export function occurrencesInMonth(
  rule: RecurringRule,
  month: string,
  tz: string,
  cap = 8,
): { day: string; n: number }[] {
  const out: { day: string; n: number }[] = [];
  let day = civilDay(rule.nextRunAt, tz);
  let n = rule.postedInstallments + 1;
  // Salta direto pro mês pedido (mensal) ou anda semana a semana (poucas iterações).
  for (let guard = 0; guard < 400 && day.slice(0, 7) <= month; guard++) {
    if (rule.totalInstallments !== null && n > rule.totalInstallments) break;
    if (day.slice(0, 7) === month) out.push({ day, n });
    if (out.length >= cap) break;
    day = nextDay(rule, day);
    n++;
  }
  return out;
}
