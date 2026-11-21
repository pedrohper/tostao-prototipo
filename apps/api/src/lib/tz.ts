// Datas no fuso da PESSOA (User.timezone, padrão America/Sao_Paulo), calculadas com Intl.DateTimeFormat.
// Nada de "menos 3 horas" fixo: o fuso real decide o dia civil, o início e o fim de cada dia e de cada mês.
// Um dia civil é uma string 'AAAA-MM-DD'; um mês é 'AAAA-MM'.

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const DAY_MS = 24 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Fuso inválido (lixo no banco) não derruba nada: cai no padrão. */
export function safeTimezone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    formatter(tz);
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export type CivilParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

/** Ano, mês, dia e hora que o relógio da parede mostra, nesse fuso, naquele instante. */
export function civilParts(date: Date, tz: string = DEFAULT_TIMEZONE): CivilParts {
  const out: Record<string, number> = {};
  for (const p of formatter(safeTimezone(tz)).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour! % 24,
    minute: out.minute!,
    second: out.second!,
  };
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

/** 'AAAA-MM-DD' do instante, no fuso. */
export function civilDay(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  const p = civilParts(date, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** 'AAAA-MM' do instante, no fuso. */
export function civilMonth(date: Date, tz: string = DEFAULT_TIMEZONE): string {
  return civilDay(date, tz).slice(0, 7);
}

/** Dia do mês (1..31) do instante, no fuso. */
export function civilDayOfMonth(date: Date, tz: string = DEFAULT_TIMEZONE): number {
  return civilParts(date, tz).day;
}

/** Diferença (ms) entre o relógio da parede no fuso e o UTC naquele instante. */
function offsetMs(date: Date, tz: string): number {
  const p = civilParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** O instante (UTC) em que o relógio da parede, nesse fuso, mostra essa data e hora. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string = DEFAULT_TIMEZONE,
): Date {
  const zone = safeTimezone(tz);
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  // Duas passadas resolvem o offset mesmo perto de uma mudança de horário.
  let utc = guess - offsetMs(new Date(guess), zone);
  utc = guess - offsetMs(new Date(utc), zone);
  return new Date(utc);
}

const parseDay = (day: string): [number, number, number] => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return [y, m, d];
};

/** Meia-noite (início) do dia civil, no fuso. */
export function startOfCivilDay(day: string, tz: string = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = parseDay(day);
  return zonedTimeToUtc(y, m, d, 0, 0, 0, tz);
}

/** Último milissegundo do dia civil em que `date` cai, no fuso. */
export function endOfCivilDay(date: Date, tz: string = DEFAULT_TIMEZONE): Date {
  return new Date(startOfCivilDay(addCivilDays(civilDay(date, tz), 1), tz).getTime() - 1);
}

/** Meio-dia do dia civil, no fuso (a hora que damos a lançamentos que só têm o dia). */
export function noonOfCivilDay(day: string, tz: string = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = parseDay(day);
  return zonedTimeToUtc(y, m, d, 12, 0, 0, tz);
}

/** Soma dias a um dia civil (calendário puro, sem fuso). */
export function addCivilDays(day: string, n: number): string {
  const [y, m, d] = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Quantos dias tem o mês 'AAAA-MM'. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** [início do mês, início do mês seguinte) no fuso. */
export function monthRange(month: string, tz: string = DEFAULT_TIMEZONE): { from: Date; to: Date } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const from = zonedTimeToUtc(y, m, 1, 0, 0, 0, tz);
  const to = m === 12 ? zonedTimeToUtc(y + 1, 1, 1, 0, 0, 0, tz) : zonedTimeToUtc(y, m + 1, 1, 0, 0, 0, tz);
  return { from, to };
}

/**
 * Data de calendário guardada como instante UTC (o Pluggy manda o vencimento da fatura como "AAAA-MM-DD" em UTC):
 * o dia que vale é o do próprio UTC, sem converter pro fuso da pessoa (converter jogaria pro dia anterior).
 */
export function calendarDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Diferença em dias entre dois dias civis (b - a). */
export function diffCivilDays(a: string, b: string): number {
  const [ay, am, ad] = parseDay(a);
  const [by, bm, bd] = parseDay(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}
