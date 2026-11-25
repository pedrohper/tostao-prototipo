// T4.3 e T6.10 · Home enxuta: quem nunca personalizou recebe o essencial; quem personalizou mantém a própria escolha.
import { HOME_SECTION_IDS } from '@tostao/contracts';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIDDEN_SECTIONS,
  HOME_SECTIONS,
  parsePrefs,
  resolveSectionOrder,
  serializePrefs,
} from './inicio-prefs';

const visibleByDefault = HOME_SECTIONS.filter((s) => !(DEFAULT_HIDDEN_SECTIONS as readonly string[]).includes(s.id));

describe('padrão enxuto', () => {
  it('mostra só avisos, pra onde foi e a próxima lição, nessa ordem (o saldo fica sempre no topo)', () => {
    expect(visibleByDefault.map((s) => s.id)).toEqual(['avisos', 'pra-onde-foi', 'aula']);
    expect(HOME_SECTIONS.length - visibleByDefault.length).toBe(DEFAULT_HIDDEN_SECTIONS.length);
  });

  it('o resto continua disponível no Personalizar', () => {
    for (const id of ['atalhos', 'pendencias', 'evolucao', 'sobra', 'vence', 'semana', 'meta', 'acertos', 'cartoes']) {
      expect(HOME_SECTIONS.map((s) => s.id as string)).toContain(id);
      expect(DEFAULT_HIDDEN_SECTIONS as readonly string[]).toContain(id);
    }
  });

  it('os blocos da web são exatamente os que a API aceita (T6.11)', () => {
    expect(HOME_SECTIONS.map((s) => s.id)).toEqual([...HOME_SECTION_IDS]);
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

  it('quem personalizou (v: 2) mantendo atalhos escondidos continua respeitado', () => {
    const p = parsePrefs(JSON.stringify({ v: 2, ocultos: ['atalhos', 'vence', 'semana', 'acertos', 'cartoes'] }));
    expect(p.ocultos).toContain('atalhos');
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

describe('T6.10 · padrão novo não apaga escolha e vale pra quem nunca escolheu', () => {
  const T43 = ['atalhos', 'vence', 'semana', 'acertos', 'cartoes'];
  const ATE_T610 = ['vence', 'semana', 'acertos', 'cartoes'];

  it.each([
    ['T4.3', T43],
    ['anterior à T6.10', ATE_T610],
    ['anterior à T6.10, em outra ordem', [...ATE_T610].reverse()],
  ])('padrão %s congelado ao fechar um aviso vira o padrão novo', (_nome, ocultos) => {
    const p = parsePrefs(JSON.stringify({ ordem: [], ocultos, fechados: ['dica:2026-11:chat'] }));
    expect(p.ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
    expect(p.fechados).toEqual(['dica:2026-11:chat']);
  });

  it('quem salvou na tela Personalizar mantém a escolha, mesmo igual a um padrão antigo', () => {
    expect(parsePrefs(JSON.stringify({ v: 2, ordem: [], ocultos: ATE_T610 })).ocultos).toEqual(ATE_T610);
    // Antes do v: 2, salvar pela tela gravava a ordem inteira.
    const ordem = HOME_SECTIONS.map((s) => s.id);
    expect(parsePrefs(JSON.stringify({ ordem, ocultos: ATE_T610 })).ocultos).toEqual(ATE_T610);
    expect(parsePrefs(JSON.stringify({ v: 2, ordem, ocultos: [] })).ocultos).toEqual([]);
  });

  it('fechar um aviso não grava o padrão no cookie (senão ele congela de novo)', () => {
    const prefs = parsePrefs(undefined);
    const cookie = serializePrefs({ ...prefs, fechados: ['dica:2026-11:chat'] });
    expect(JSON.parse(cookie)).toEqual({ ordem: [], fechados: ['dica:2026-11:chat'] });
    expect(parsePrefs(cookie).ocultos).toEqual([...DEFAULT_HIDDEN_SECTIONS]);
  });

  it('a escolha vai pro cookie e volta igual', () => {
    const escolha = { v: 2, ordem: ['aula', 'avisos'], ocultos: ['semana'], fechados: [] };
    expect(parsePrefs(serializePrefs(escolha))).toEqual(escolha);
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
