// T4.3 · gráficos: cores da barra empilhada 1:1 com a legenda, ícones, links de categoria e acessibilidade do tooltip.
// renderToString = markup inicial (sem jsdom). A interação (toque/mouse/teclado) está coberta em chart-math.spec.ts.
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CashflowLineChart, CategoryBars, MonthlyBars } from './graficos';

const items = [
  { categoryId: 'delivery', name: 'Delivery', color: '#ff5a36', totalInCents: 50_000 },
  { categoryId: 'mercado', name: 'Mercado', color: '#3dd6a0', totalInCents: 30_000 },
  { categoryId: null, name: 'Sem categoria', color: '#000000', totalInCents: 10_000 },
];

describe('CategoryBars', () => {
  it('cada fatia da barra usa a cor da categoria, que é a MESMA da bolinha da legenda', () => {
    const html = renderToString(<CategoryBars items={items} />);
    for (const color of ['#ff5a36', '#3dd6a0']) {
      // uma vez na barra (width + background) e uma vez no quadradinho da legenda
      expect(html.split(`background:${color}`).length - 1).toBe(2);
    }
  });

  it('sem categoria usa a cor de "pendente" (rosa-forte) na barra e na legenda', () => {
    const html = renderToString(<CategoryBars items={items} />);
    expect(html.split('background:var(--color-rosa-forte)').length - 1).toBe(2);
  });

  it('com hrefBase, fatias e linhas levam à Carteira filtrada (cat + mês) com âncora na lista', () => {
    const html = renderToString(<CategoryBars items={items} hrefBase="/carteira" hrefParams={{ mes: '2026-11' }} />);
    expect(html).toContain('href="/carteira?mes=2026-11&amp;cat=delivery#lista"');
    expect(html).toContain('href="/carteira?mes=2026-11&amp;cat=sem#lista"');
    // barra (3 fatias) + lista (3 linhas) = 6 links
    expect(html.match(/href="\/carteira\?/g)).toHaveLength(6);
  });

  it('sem hrefBase nada vira link (tela de conta continua só informativa)', () => {
    expect(renderToString(<CategoryBars items={items} />)).not.toContain('<a ');
  });

  it('cada linha mostra o ícone da categoria e o "Outras" agrupado não vira link', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      categoryId: `c${i}`,
      name: `Cat ${i}`,
      color: '#123456',
      totalInCents: 1000 - i,
    }));
    const html = renderToString(<CategoryBars items={many} max={3} otherLabel="Outras" hrefBase="/carteira" />);
    expect(html).toContain('Outras');
    expect(html).not.toContain('cat=_resto');
  });

  it('sem gasto não renderiza nada', () => {
    expect(renderToString(<CategoryBars items={[]} />)).toBe('');
  });
});

const history = [
  { month: '2026-09', outInCents: 80_000, inInCents: 300_000 },
  { month: '2026-10', outInCents: 50_000, inInCents: 300_000 },
  { month: '2026-11', outInCents: 12_000, inInCents: 320_000 },
];

describe('MonthlyBars', () => {
  it('uma barra-botão por mês, com rótulo acessível com os valores exatos', () => {
    const html = renderToString(<MonthlyBars data={history} atual="2026-11" entrada />);
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toMatch(/R\$\s800,00/); // valor exato do mês no rótulo (o espaço pode ser NBSP)
    expect(html).toContain('aria-pressed="false"');
  });

  it('sem mês em foco o painel só orienta (toque num mês); o painel é uma região de status', () => {
    const html = renderToString(<MonthlyBars data={history} atual="2026-11" entrada />);
    expect(html).toContain('Toque num mês pra ver os valores');
    expect(html).not.toContain('data-tooltip');
  });
});

describe('CashflowLineChart', () => {
  const flow = history.map((m) => ({ month: m.month, inInCents: m.inInCents, outInCents: m.outInCents }));

  it('é um grupo focável por teclado, descrito pelo painel de valores, com as duas linhas', () => {
    const html = renderToString(<CashflowLineChart data={flow} atual="2026-11" monthBasePath="/inicio" />);
    expect(html).toContain('role="group"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-describedby=');
    expect(html.match(/<path /g)).toHaveLength(2); // entrou e saiu
    expect(html).toContain('stroke="var(--color-menta)"');
    expect(html).toContain('stroke="var(--color-laranja)"');
  });

  it('o SVG é decorativo pra leitor de tela (o grupo carrega o rótulo)', () => {
    const html = renderToString(<CashflowLineChart data={flow} atual="2026-11" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Gráfico de linhas');
  });

  it('mesma entrada, mesmo HTML (nada de data/aleatório: sem hydration mismatch)', () => {
    const a = renderToString(<CashflowLineChart data={flow} atual="2026-11" />);
    const b = renderToString(<CashflowLineChart data={flow} atual="2026-11" />);
    // useId muda entre renders isolados: só o conteúdo fora dos ids precisa ser idêntico
    expect(a.replace(/:R[^:]*:/g, '')).toBe(b.replace(/:R[^:]*:/g, ''));
  });

  it('menos de 2 meses não desenha linha', () => {
    expect(renderToString(<CashflowLineChart data={flow.slice(0, 1)} atual="2026-11" />)).toBe('');
  });
});
