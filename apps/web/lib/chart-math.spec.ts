// T4.3 · contas dos gráficos: cores da barra empilhada 1:1 com a legenda, % da renda, linha e navegação por teclado.
import { describe, expect, it } from 'vitest';
import {
  changePct,
  FALLBACK_SEGMENT_COLOR,
  linePoints,
  nearestIndex,
  pathFromPoints,
  pctOf,
  stackedSegments,
  stepIndex,
} from './chart-math';

const cats = [
  { categoryId: 'delivery', name: 'Delivery', color: '#FF5A36', totalInCents: 50_000 },
  { categoryId: 'mercado', name: 'Mercado', color: '#3DD6A0', totalInCents: 30_000 },
  { categoryId: 'role', name: 'Rolê', color: '#FFC233', totalInCents: 20_000 },
];

describe('stackedSegments() · barra empilhada', () => {
  it('a cor de cada fatia é a cor da categoria (a mesma da legenda), na mesma ordem', () => {
    const segs = stackedSegments(cats, 100_000);
    expect(segs.map((s) => s.color)).toEqual(cats.map((c) => c.color));
    expect(segs.map((s) => s.key)).toEqual(['delivery', 'mercado', 'role']);
  });

  it('pct é parte do gasto TOTAL (o que a legenda mostra); largura soma 100% na barra', () => {
    const segs = stackedSegments(cats, 200_000); // gasto total maior que o das 3 categorias
    expect(segs.map((s) => s.pct)).toEqual([25, 15, 10]);
    expect(segs.reduce((s, x) => s + x.widthPct, 0)).toBeCloseTo(100, 5);
  });

  it('categoria sem cor cai no mesmo fallback da legenda (não numa cor posicional)', () => {
    const segs = stackedSegments(
      [
        { categoryId: 'x', name: 'X', color: '', totalInCents: 10 },
        { categoryId: null, name: 'Sem', color: null, totalInCents: 10 },
      ],
      20,
    );
    expect(segs.every((s) => s.color === FALLBACK_SEGMENT_COLOR)).toBe(true);
    expect(segs[1]!.key).toBe('sem');
  });

  it('fatia minúscula ainda aparece (largura mínima) e valor zero some', () => {
    const segs = stackedSegments(
      [
        { categoryId: 'a', name: 'A', color: '#111', totalInCents: 999_999 },
        { categoryId: 'b', name: 'B', color: '#222', totalInCents: 1 },
        { categoryId: 'c', name: 'C', color: '#333', totalInCents: 0 },
      ],
      1_000_000,
    );
    expect(segs).toHaveLength(2);
    expect(segs[1]!.widthPct).toBeGreaterThanOrEqual(2);
  });

  it('sem itens ou total zero não divide por zero', () => {
    expect(stackedSegments([], 0)).toEqual([]);
    expect(stackedSegments(cats, 0).every((s) => Number.isFinite(s.pct))).toBe(true);
  });
});

describe('pctOf() / changePct()', () => {
  it('% arredondado; sem base (renda 0) devolve null pra UI esconder a linha', () => {
    expect(pctOf(34_000, 100_000)).toBe(34);
    expect(pctOf(1, 3)).toBe(33);
    expect(pctOf(50, 0)).toBeNull();
    expect(pctOf(Number.NaN, 100)).toBeNull();
  });

  it('variação entre meses, com sinal; mês anterior zerado não tem comparação', () => {
    expect(changePct(112_00, 100_00)).toBe(12);
    expect(changePct(80_00, 100_00)).toBe(-20);
    expect(changePct(5, 0)).toBeNull();
  });
});

describe('linePoints() / pathFromPoints()', () => {
  const dims = { width: 320, height: 132, padX: 12, padY: 12 };

  it('x distribui os pontos nas bordas com folga; y maior valor fica no topo', () => {
    const pts = linePoints([0, 50, 100], dims);
    expect(pts[0]!.x).toBe(12);
    expect(pts[2]!.x).toBe(308);
    expect(pts[2]!.y).toBe(12); // valor máximo = topo (com folga)
    expect(pts[0]!.y).toBe(120); // zero = base (com folga)
    expect(pts[1]!.y).toBeCloseTo(66, 5);
  });

  it('as duas linhas do gráfico usam a MESMA escala (max compartilhado)', () => {
    const a = linePoints([100], { ...dims, max: 200 });
    const b = linePoints([200], { ...dims, max: 200 });
    expect(a[0]!.y).toBeGreaterThan(b[0]!.y);
  });

  it('um ponto só fica no meio; lista vazia não quebra; negativo vira zero', () => {
    expect(linePoints([10], dims)[0]!.x).toBe(160);
    expect(linePoints([], dims)).toEqual([]);
    expect(linePoints([-5, 5], dims)[0]!.y).toBe(120);
  });

  it('o path arredonda em 1 casa (HTML igual no servidor e no navegador)', () => {
    expect(
      pathFromPoints([
        { x: 1.23456, y: 2 },
        { x: 3, y: 4.987 },
      ]),
    ).toBe('M1.2 2 L3 5');
    expect(pathFromPoints([])).toBe('');
  });
});

describe('nearestIndex() / stepIndex() · toque, mouse e teclado', () => {
  const pts = linePoints([1, 2, 3, 4], { width: 300, height: 100, padX: 0 });

  it('escolhe o ponto mais perto do toque', () => {
    expect(nearestIndex(pts, -50)).toBe(0);
    expect(nearestIndex(pts, 105)).toBe(1);
    expect(nearestIndex(pts, 290)).toBe(3);
  });

  it('setas andam um mês, Home/End vão às pontas, nunca sai do intervalo', () => {
    expect(stepIndex(1, 'ArrowRight', 4)).toBe(2);
    expect(stepIndex(1, 'ArrowLeft', 4)).toBe(0);
    expect(stepIndex(0, 'ArrowLeft', 4)).toBe(0);
    expect(stepIndex(3, 'ArrowRight', 4)).toBe(3);
    expect(stepIndex(2, 'Home', 4)).toBe(0);
    expect(stepIndex(1, 'End', 4)).toBe(3);
    expect(stepIndex(1, 'a', 4)).toBe(1);
    expect(stepIndex(0, 'ArrowRight', 0)).toBe(0);
  });
});
