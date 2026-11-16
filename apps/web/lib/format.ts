import { getDictionary, type Locale } from './i18n';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 84230 -> "R$ 842,30" */
export function money(cents: number) {
  return brl.format(cents / 100).replace(/ /g, ' ');
}

/** "R$ 1.234,56" | "1234,56" | "12" -> cents. Returns null if unparseable. */
export function parseMoney(text: string): number | null {
  const clean = text
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(clean);
  return Number.isFinite(n) && clean !== '' ? Math.round(n * 100) : null;
}

export function currentMonth(now = new Date()) {
  const br = new Date(now.getTime() - 3 * 3600_000);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthName(month: string, locale: Locale = 'pt-BR') {
  const months = getDictionary(locale).months;
  return months[Number(month.slice(5, 7)) - 1] ?? month;
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "Domingo, 8" / "Sunday, 8" */
export function dayLabel(iso: string, locale: Locale = 'pt-BR') {
  const d = new Date(iso);
  const s = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', timeZone: 'America/Sao_Paulo' });
  const [w, n] = s.split(', ');
  const wd = (w ?? s).replace('-feira', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}${n ? `, ${n}` : ''}`;
}

export function nowMs() {
  return Date.now();
}

export function currentDayOfMonth(now = Date.now()) {
  return new Date(now - 3 * 3600_000).getUTCDate();
}

export function todayIso() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** "10/12" in Brasilia timezone. */
export function shortDate(iso: string, locale: Locale = 'pt-BR') {
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}

/** "agora", "há 2 h", "há 3 dias" / "just now", "2h ago", "3 days ago". */
export function ago(iso: string, now = nowMs(), locale: Locale = 'pt-BR') {
  const timeDict = getDictionary(locale).time;
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 5) return timeDict.now;
  if (min < 60) return timeDict.minutesAgo(min);
  const h = Math.round(min / 60);
  if (h < 24) return timeDict.hoursAgo(h);
  const d = Math.round(h / 24);
  return timeDict.daysAgo(d);
}

/** "Segunda, 9 de novembro" / "Monday, November 9" in Brasilia timezone. */
export function fullDateLabel(date = new Date(), locale: Locale = 'pt-BR') {
  const formatted = date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  });
  const cleaned = formatted.replace('-feira', '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** "atualizado hoje às 06:12" / "updated today at 06:12" in Brasilia timezone. */
export function updatedTimeLabel(iso: string, locale: Locale = 'pt-BR') {
  const d = new Date(iso);
  const tz = { timeZone: 'America/Sao_Paulo' } as const;
  const isToday = d.toLocaleDateString(locale, tz) === new Date().toLocaleDateString(locale, tz);
  const t = getDictionary(locale);
  const dayText = isToday
    ? t.time.today
    : d.toLocaleDateString(locale, { ...tz, day: 'numeric', month: 'short' }).replace('.', '');
  const timeText = d.toLocaleTimeString(locale, { ...tz, hour: '2-digit', minute: '2-digit' });
  return t.time.updatedAt(dayText, timeText);
}

/** Valida ?voltar= para evitar redirecionamento externo e padronizar a volta das sub-rotas. */
export function resolveBackHref(raw: string | string[] | undefined | null, fallback: string): string {
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (typeof val === 'string' && val.startsWith('/') && !val.startsWith('//')) {
    return val;
  }
  return fallback;
}
