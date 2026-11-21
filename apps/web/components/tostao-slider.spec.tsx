import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Selo, type SeloTipo } from './selo';
import { TostaoSlider, sliderPercent } from './tostao-slider';

describe('sliderPercent', () => {
  it('proporção do trilho, limitada a 0..100 e segura contra min = max', () => {
    expect(sliderPercent(50, 0, 100)).toBe(50);
    expect(sliderPercent(1200, 1200, 6000)).toBe(0);
    expect(sliderPercent(3600, 1200, 6000)).toBe(50);
    expect(sliderPercent(-5, 0, 10)).toBe(0);
    expect(sliderPercent(99, 0, 10)).toBe(100);
    expect(sliderPercent(5, 5, 5)).toBe(0);
  });
});

describe('TostaoSlider', () => {
  const html = renderToString(
    <TostaoSlider value={20} min={10} max={30} step={5} onChange={() => {}} tone="amarelo" />,
  );

  it('continua sendo um <input type="range"> com a mesma régua (teclado e leitor de tela)', () => {
    expect(html).toContain('type="range"');
    expect(html).toContain('min="10"');
    expect(html).toContain('max="30"');
    expect(html).toContain('step="5"');
    expect(html).toContain('value="20"');
  });

  it('é estilizado pela classe do design system, com o tom e o preenchimento do trilho', () => {
    expect(html).toContain('class="tostao-slider"');
    expect(html).toContain('data-tone="amarelo"');
    expect(html).toContain('--pct:50%');
  });

  it('repassa atributos de acessibilidade e o tom padrão é laranja', () => {
    const out = renderToString(
      <TostaoSlider value={1} min={0} max={10} onChange={() => {}} aria-label="Quanto" aria-valuetext="R$ 1" />,
    );
    expect(out).toContain('aria-label="Quanto"');
    expect(out).toContain('aria-valuetext="R$ 1"');
    expect(out).toContain('data-tone="laranja"');
  });
});

describe('Selo (no lugar dos emojis nativos)', () => {
  const tipos: SeloTipo[] = [
    'alerta',
    'perigo',
    'meta',
    'ok',
    'erro',
    'dica',
    'brilho',
    'tempo',
    'fogo',
    'dados',
    'queda',
    'alta',
    'dinheiro',
  ];
  it('todos os tipos renderizam um SVG decorativo (aria-hidden), sem nenhum emoji', () => {
    for (const tipo of tipos) {
      const html = renderToString(<Selo tipo={tipo} />);
      expect(html, tipo).toContain('<svg');
      expect(html, tipo).toContain('aria-hidden="true"');
      expect(html, tipo).toContain(`data-selo="${tipo}"`);
      expect(html, tipo).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
