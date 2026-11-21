// T4.5 · vitrine da landing: abas acessíveis, painel ativo visível e os outros escondidos, dados fictícios rotulados.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VITRINE_TABS } from '@/lib/landing-content';
import { LandingVitrine } from './landing-vitrine';

const html = renderToString(<LandingVitrine />);
const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('LandingVitrine (markup inicial)', () => {
  it('é um tablist com uma aba por tela e só a primeira selecionada e focável', () => {
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(VITRINE_TABS.length);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(VITRINE_TABS.length - 1);
  });

  it('cada aba aponta pro seu painel e o painel aponta de volta', () => {
    for (const t of VITRINE_TABS) {
      expect(html).toContain(`id="vt-tab-${t.id}"`);
      expect(html).toContain(`aria-controls="vt-panel-${t.id}"`);
      expect(html).toContain(`id="vt-panel-${t.id}"`);
      expect(html).toContain(`aria-labelledby="vt-tab-${t.id}"`);
    }
  });

  it('só o painel da primeira aba está visível (os outros ficam hidden, sem JS também)', () => {
    expect(html.match(/hidden=""/g)).toHaveLength(VITRINE_TABS.length - 1);
    const firstPanel = html.slice(html.indexOf('id="vt-panel-inicio"'), html.indexOf('id="vt-panel-chat"'));
    expect(firstPanel).not.toContain('hidden=""');
  });

  it('os cinco mockups usam dados fictícios (e dizem isso) e descrevem a tela pro leitor de tela', () => {
    expect(html.match(/Exemplo com dados fictícios/g)).toHaveLength(5);
    for (const t of VITRINE_TABS) expect(html).toContain(`aria-label="${t.mockAlt}"`);
    // o desenho do app é decorativo: o conteúdo é lido pela descrição, não duas vezes
    expect(html.match(/role="img"/g)).toHaveLength(5);
  });

  it('mostra os números dos mockups coerentes entre si (R$ 20 x 4 por semana = R$ 1.040 em 3 meses, R$ 4.160 em 1 ano)', () => {
    expect(plain).toContain('R$ 1.040');
    expect(plain).toContain('R$ 4.160');
    expect(20 * 4 * 13).toBe(1040);
    expect(20 * 4 * 52).toBe(4160);
    // assinaturas: 55,90 + 21,90 + 89,90 = 167,70 por mês, x12 = 2.012,40
    expect(plain).toContain('R$ 167,70 por mês');
    expect(plain).toContain('R$ 2.012,40 por ano');
    expect(5590 + 2190 + 8990).toBe(16770);
    expect(16770 * 12).toBe(201240);
  });

  it('sem emoji nativo (a landing é a vitrine: nada que mude de cara em cada celular)', () => {
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
