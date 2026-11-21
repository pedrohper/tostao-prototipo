// Mês no fuso da pessoa (padrão Brasília). Tudo vem de lib/tz.ts (Intl, sem offset fixo).
import { civilMonth, DEFAULT_TIMEZONE, monthRange as zonedMonthRange } from './tz.js';

/** Intervalo [from, to) do mês 'AAAA-MM' no fuso. */
export function monthRange(month: string, tz: string = DEFAULT_TIMEZONE): { from: Date; to: Date } {
  return zonedMonthRange(month, tz);
}

export function currentMonth(now = new Date(), tz: string = DEFAULT_TIMEZONE): string {
  return civilMonth(now, tz);
}
