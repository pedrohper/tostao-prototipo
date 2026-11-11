// Mês no fuso de Brasília. Atalho do protótipo: offset fixo -03:00 (o Brasil não tem horário de verão desde 2019).
export function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const from = new Date(`${month}-01T00:00:00-03:00`);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const to = new Date(`${next}-01T00:00:00-03:00`);
  return { from, to }; // intervalo [from, to)
}

export function currentMonth(now = new Date()): string {
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, '0')}`;
}
