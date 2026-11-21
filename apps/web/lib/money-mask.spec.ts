// T4.4 · máscara do valor no "Anotar rápido": digitar vira centavos; colar respeita a intenção; o servidor lê igual.
import { describe, expect, it } from 'vitest';
import { parseMoney } from './format';
import { centsFromMasked, formatCents, MAX_MASK_CENTS, maskMoneyInput, maskPastedMoney } from './money-mask';

/** Simula a pessoa digitando tecla por tecla (cada tecla passa pelo `onChange` com o texto já mascarado). */
const type = (keys: string) => [...keys].reduce((value, key) => maskMoneyInput(value + key), '');

describe('formatCents()', () => {
  it('milhar com ponto e centavos com vírgula', () => {
    expect(formatCents(1)).toBe('0,01');
    expect(formatCents(1250)).toBe('12,50');
    expect(formatCents(123456)).toBe('1.234,56');
    expect(formatCents(100_000_000)).toBe('1.000.000,00');
  });

  it('zero, negativo e lixo viram vazio (o placeholder 0,00 aparece)', () => {
    expect(formatCents(0)).toBe('');
    expect(formatCents(-5)).toBe('');
    expect(formatCents(Number.NaN)).toBe('');
  });
});

describe('maskMoneyInput() · digitando centavos', () => {
  it('1 → 0,01 · 12 → 0,12 · 1250 → 12,50 · 123456 → 1.234,56', () => {
    expect(type('1')).toBe('0,01');
    expect(type('12')).toBe('0,12');
    expect(type('1250')).toBe('12,50');
    expect(type('123456')).toBe('1.234,56');
  });

  it('apagar com backspace volta um dígito (e esvazia no fim)', () => {
    let v = type('1250');
    v = maskMoneyInput(v.slice(0, -1)); // "12,5" → dígitos 125 → 1,25
    expect(v).toBe('1,25');
    v = maskMoneyInput(v.slice(0, -1));
    expect(v).toBe('0,12');
    v = maskMoneyInput(v.slice(0, -1));
    expect(v).toBe('0,01');
    expect(maskMoneyInput(v.slice(0, -1))).toBe('');
  });

  it('zeros à esquerda não contam e letras/símbolos são ignorados', () => {
    expect(type('0')).toBe('');
    expect(type('007')).toBe('0,07');
    expect(maskMoneyInput('R$ 12a,3b')).toBe('1,23');
    expect(maskMoneyInput('abc')).toBe('');
  });

  it('respeita o teto do contrato (R$ 100 milhões): o dígito que estoura é ignorado', () => {
    const max = formatCents(MAX_MASK_CENTS);
    expect(max).toBe('100.000.000,00');
    expect(type(String(MAX_MASK_CENTS))).toBe(max);
    expect(maskMoneyInput(`${max}9`)).toBe(max);
  });
});

describe('centsFromMasked() · o que o formulário valida', () => {
  it('lê o texto mascarado em centavos; vazio ou zero é null', () => {
    expect(centsFromMasked('12,50')).toBe(1250);
    expect(centsFromMasked('1.234,56')).toBe(123456);
    expect(centsFromMasked('')).toBeNull();
    expect(centsFromMasked('0,00')).toBeNull();
  });

  it('PARIDADE com o servidor: parseMoney lê exatamente o que a máscara produz, em qualquer valor', () => {
    const samples = [
      1,
      9,
      10,
      99,
      100,
      101,
      999,
      1000,
      12345,
      99999,
      100000,
      123456,
      1_000_000,
      12_345_678,
      987_654_321,
      MAX_MASK_CENTS,
    ];
    for (const cents of samples) {
      const masked = formatCents(cents);
      expect(parseMoney(masked), masked).toBe(cents);
      expect(centsFromMasked(masked)).toBe(cents);
    }
  });
});

describe('maskPastedMoney() · colar tem intenção', () => {
  it('só dígitos colados são reais inteiros ("12" = R$ 12,00, não 0,12)', () => {
    expect(maskPastedMoney('12')).toBe('12,00');
    expect(maskPastedMoney('1500')).toBe('1.500,00');
  });

  it('com separador decimal, é decimal (vírgula ou ponto)', () => {
    expect(maskPastedMoney('12,5')).toBe('12,50');
    expect(maskPastedMoney('12.50')).toBe('12,50');
    expect(maskPastedMoney('R$ 1.234,56')).toBe('1.234,56');
    expect(maskPastedMoney('  R$ 7,90 ')).toBe('7,90');
  });

  it('ambíguo, zero ou absurdo vira vazio (melhor limpar que errar 100x)', () => {
    expect(maskPastedMoney('1,500')).toBe('');
    expect(maskPastedMoney('1.5000')).toBe('');
    expect(maskPastedMoney('0')).toBe('');
    expect(maskPastedMoney('abc')).toBe('');
    expect(maskPastedMoney('999999999999')).toBe('');
  });
});
