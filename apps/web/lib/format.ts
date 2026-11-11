const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 84230 -> "R$ 842,30" */
export function money(cents: number) {
  return brl.format(cents / 100).replace(/ /g, ' ');
}

/** "R$ 1.234,56" | "1234,56" | "12" -> centavos. Retorna null se não der pra ler. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(clean);
  return Number.isFinite(n) && clean !== '' ? Math.round(n * 100) : null;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function currentMonth(now = new Date()) {
  const br = new Date(now.getTime() - 3 * 3600_000);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthName(month: string) {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "Domingo, 8" */
export function dayLabel(iso: string) {
  const d = new Date(iso);
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', timeZone: 'America/Sao_Paulo' });
  const [w, n] = s.split(', ');
  const wd = (w ?? s).replace('-feira', '');
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${n ?? ''}`.replace(/, $/, '');
}

export function todayIso() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
