// T4.3 · Home enxuta: quem nunca personalizou recebe o essencial; quem personalizou mantém a própria escolha.
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { DEFAULT_HIDDEN_SECTIONS, HOME_SECTIONS, parsePrefs, resolveSectionOrder } from './inicio-prefs';

const visibleByDefault = HOME_SECTIONS.filter((s) => !(DEFAULT_HIDDEN_SECTIONS as readonly string[]).includes(s.id));

describe('padrão enxuto', () => {
  it('liga só 7 seções (5–6 blocos do doc: evolução, avisos, pra onde foi, limites, previsão, meta e aula)', () => {
    expect(visibleByDefault.map((s) => s.id).sort()).toEqual(
      ['avisos', 'aula', 'evolucao', 'limites', 'meta', 'pra-onde-foi', 'sobra'].sort(),
    );
    expect(visibleByDefault.length).toBeLessThanOrEqual(7);
    expect(HOME_SECTIONS.length - visibleByDefault.length).toBe(DEFAULT_HIDDEN_SECTIONS.length);
  });

  it('só esconde ids que existem (nada de seção fantasma no padrão)', () => {
    const ids = HOME_SECTIONS.map((s) => s.id) as string[];
    for (const id of DEFAULT_HIDDEN_SECTIONS) expect(ids).toContain(id);
  });
});

describe('parsePrefs()', () => {
  it('sem cookie, ou cookie ilegível, vale o padrão enxuto', () => {
    expect(parsePrefs(undefined).ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
    expect(parsePrefs('{lixo').ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
  });

  it('cookie só com alertas dispensados (sem a chave `ocultos`) AINDA recebe o padrão', () => {
    const p = parsePrefs(JSON.stringify({ fechados: ['pendentes:2026-11:3'] }));
    expect(p.ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
    expect(p.fechados).toEqual(['pendentes:2026-11:3']);
  });

  it('quem personalizou mantém a escolha, mesmo que seja "nada escondido"', () => {
    expect(parsePrefs(JSON.stringify({ ocultos: [] })).ocultos).toEqual([]);
    expect(parsePrefs(JSON.stringify({ ocultos: ['semana'] })).ocultos).toEqual(['semana']);
  });

  it('valores de tipo errado não entram', () => {
    const p = parsePrefs(JSON.stringify({ ocultos: ['semana', 7, null], ordem: 'x', fechados: [1] }));
    expect(p.ocultos).toEqual(['semana']);
    expect(p.ordem).toEqual([]);
    expect(p.fechados).toEqual([]);
  });
});

describe('resolveSectionOrder()', () => {
  it('seção nova (evolucao) aparece pra quem já tinha ordem salva, no fim da lista', () => {
    const order = resolveSectionOrder({ ordem: ['avisos', 'aula'], ocultos: [], fechados: [] });
    expect(order.slice(0, 2)).toEqual(['avisos', 'aula']);
    expect(order).toContain('evolucao');
    expect(new Set(order).size).toBe(HOME_SECTIONS.length);
  });
});
