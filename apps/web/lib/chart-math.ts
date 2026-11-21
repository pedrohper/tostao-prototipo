// Contas dos gráficos da Home e da Carteira (T4.3), sem React: tooltips, barra empilhada e linha de fluxo.

export type Segment = { key: string; name: string; color: string; totalInCents: number; pct: number; widthPct: number };

export const FALLBACK_SEGMENT_COLOR = 'var(--color-papel-2)';

/**
 * Segmentos da barra empilhada de categorias. A COR de cada segmento é a da categoria (`color`), a mesma da legenda
 * logo abaixo: antes o desktop pintava por posição (laranja, tinta, menta...) e não batia com a legenda.
 * `pct` é a parte do gasto TOTAL (o que a legenda mostra); `widthPct` é a largura na barra (as partes somam 100%).
 */
export function stackedSegments(
  items: { categoryId: string | null; name: string; color?: string | null; totalInCents: number }[],
  totalSpendInCents: number,
  minWidthPct = 2,
): Segment[] {
  const barTotal = Math.max(
    1,
    items.reduce((s, c) => s + Math.max(0, c.totalInCents), 0),
  );
  const spend = Math.max(1, totalSpendInCents || barTotal);
  return items
    .filter((c) => c.totalInCents > 0)
    .map((c) => ({
      key: c.categoryId ?? 'sem',
      name: c.name,
      color: c.color?.trim() ? c.color : FALLBACK_SEGMENT_COLOR,
      totalInCents: c.totalInCents,
      pct: Math.round((c.totalInCents / spend) * 100),
      widthPct: Math.max(minWidthPct, (c.totalInCents / barTotal) * 100),
    }));
}

/** "34%" da renda; null quando não há renda pra comparar (a UI esconde a linha). */
export function pctOf(valueInCents: number, baseInCents: number): number | null {
  if (!(baseInCents > 0) || !Number.isFinite(valueInCents)) return null;
  return Math.round((Math.max(0, valueInCents) / baseInCents) * 100);
}

/** Variação % entre dois meses ("+12%"). null sem base de comparação (mês anterior zerado). */
export function changePct(current: number, previous: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Linha do gráfico de fluxo: pontos (x,y) já em coordenadas do SVG, com folga nas bordas. */
export type LinePoint = { x: number; y: number };

export function linePoints(
  values: number[],
  {
    width,
    height,
    padX = 12,
    padY = 12,
    max,
  }: { width: number; height: number; padX?: number; padY?: number; max?: number },
): LinePoint[] {
  if (values.length === 0) return [];
  const top = Math.max(1, max ?? Math.max(...values));
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  return values.map((v, i) => ({
    x: values.length === 1 ? width / 2 : padX + (i / (values.length - 1)) * innerW,
    y: padY + innerH - (Math.max(0, v) / top) * innerH,
  }));
}

/** `d` do <path> (linha reta entre os pontos; arredondado em 1 casa pra o HTML não variar entre servidor e navegador). */
export function pathFromPoints(points: LinePoint[]): string {
  const f = (n: number) => String(Math.round(n * 10) / 10);
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join(' ');
}

/** Índice do ponto/barra mais perto de `x` (toque ou mouse), pra mostrar o tooltip certo. */
export function nearestIndex(points: LinePoint[], x: number): number {
  let best = 0;
  let bestDist = Infinity;
  points.forEach((p, i) => {
    const d = Math.abs(p.x - x);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** Teclado no gráfico: setas movem o foco entre os pontos sem sair do intervalo. */
export function stepIndex(current: number, key: string, length: number): number {
  if (length <= 0) return 0;
  if (key === 'ArrowRight' || key === 'ArrowDown') return Math.min(length - 1, current + 1);
  if (key === 'ArrowLeft' || key === 'ArrowUp') return Math.max(0, current - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return current;
}
