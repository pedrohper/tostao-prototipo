import { describe, expect, it } from 'vitest';
import { dilemmaLead, dilemmaOptions } from './lesson-dilemma';
import { modules } from './lessons';

describe('dilemmaLead', () => {
  it('pergunta que é só "Opção A: ... vs. Opção B: ..." não tem enunciado (null): as opções ficam só nos botões', () => {
    expect(dilemmaLead('Opção A: Anotar tudo vs. Opção B: acompanhar só o total.')).toBeNull();
    expect(dilemmaLead('Opcao a - cortar vs. Opcao b - manter')).toBeNull(); // sem acento e com traço
  });

  it('enunciado antes da Opção A é preservado', () => {
    expect(dilemmaLead('O que você faz com o 13º? Opção A: guarda vs. Opção B: gasta')).toBe(
      'O que você faz com o 13º?',
    );
  });

  it('pergunta normal, sem "Opção A", é o próprio enunciado', () => {
    expect(dilemmaLead('Você abriria mão do rolê?')).toBe('Você abriria mão do rolê?');
  });
});

describe('dilemmaOptions', () => {
  it('usa optionA/optionB do conteúdo', () => {
    expect(dilemmaOptions({ question: 'x', optionA: ' cortar ', optionB: 'manter' })).toEqual({
      a: 'cortar',
      b: 'manter',
    });
  });
  it('sem os campos, extrai da pergunta (sem o ponto final)', () => {
    expect(dilemmaOptions({ question: 'Opção A: Anotar tudo vs. Opção B: acompanhar o total.' })).toEqual({
      a: 'Anotar tudo',
      b: 'acompanhar o total',
    });
  });
});

describe('conteúdo real das 45 lições', () => {
  const all = modules.flatMap((m) => m.lessons);
  it('toda lição tem as duas opções preenchidas e nenhum enunciado sobrando (nada repete nos botões)', () => {
    expect(all).toHaveLength(45);
    for (const l of all) {
      const { a, b } = dilemmaOptions(l.dilemma);
      expect(a, l.id).not.toBe('');
      expect(b, l.id).not.toBe('');
      expect(dilemmaLead(l.dilemma.question), l.id).toBeNull();
    }
  });
});
