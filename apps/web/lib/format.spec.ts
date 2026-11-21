import { describe, expect, it } from 'vitest';
import { money, parseMoney, resolveBackHref } from './format';

describe('parseMoney', () => {
  describe('formato BR (vírgula decimal)', () => {
    it.each([
      ['12,50', 1250],
      ['0,99', 99],
      ['1.250,50', 125050],
      ['1.234,56', 123456],
      ['R$ 1.234,56', 123456],
      ['R$1.234,56', 123456],
      ['r$ 12,5', 1250],
      ['1.234.567,89', 123456789],
      ['12', 1200],
      ['1234', 123400],
      ['0', 0],
      ['0,00', 0],
      [',5', 50],
      ['12,5', 1250],
      ['  12,50  ', 1250],
      ['R$ 12,50', 1250], // espaço sem quebra, que o Intl.NumberFormat gera
    ])('%j -> %j', (text, cents) => {
      expect(parseMoney(text)).toBe(cents);
    });
  });

  describe('formato US (ponto decimal)', () => {
    it.each([
      ['12.50', 1250], // o bug original: virava 1250,00 (100x)
      ['12.5', 1250],
      ['0.99', 99],
      ['.5', 50],
      ['1,234.56', 123456],
      ['1,500.50', 150050],
      ['1,234,567.89', 123456789],
    ])('%j -> %j', (text, cents) => {
      expect(parseMoney(text)).toBe(cents);
    });
  });

  describe('ponto como separador de milhar', () => {
    it.each([
      ['1.500', 150000],
      ['1.234.567', 123456700],
      ['12.000', 1200000],
      ['1,234,567', 123456700],
    ])('%j -> %j', (text, cents) => {
      expect(parseMoney(text)).toBe(cents);
    });
  });

  describe('negativos', () => {
    it.each([
      ['-50', -5000],
      ['-12,50', -1250],
      ['-1.234,56', -123456],
      ['-R$ 12,50', -1250],
      ['-0,99', -99],
    ])('%j -> %j', (text, cents) => {
      expect(parseMoney(text)).toBe(cents);
    });
  });

  describe('entradas inválidas ou ambíguas viram null (nunca um valor 100x errado)', () => {
    it.each([
      ['abc'],
      [''],
      ['   '],
      ['R$'],
      ['-'],
      [','],
      ['.'],
      ['1,500'], // BR: 1,5 ou US: 1500? ambíguo, pede de novo
      ['12,345'],
      ['1.5000'],
      ['0.500'],
      ['12.345,678'],
      ['1,2,3'],
      ['1.2.3'],
      ['1.234,56,7'],
      ['1.234.56'],
      ['12abc'],
      ['12 reais'],
      ['1e5'],
      ['--5'],
      ['5-'],
      ['+5'],
      ['NaN'],
      ['Infinity'],
      ['99999999999999999999'],
    ])('%j -> null', (text) => {
      expect(parseMoney(text)).toBeNull();
    });
  });

  it('ida e volta com money(): o que o app mostra, o parser entende', () => {
    for (const cents of [0, 1, 99, 100, 1250, 123456, 100000000]) {
      expect(parseMoney(money(cents).replace('R$', ''))).toBe(cents);
      expect(parseMoney(money(cents))).toBe(cents);
    }
  });

  it('nunca devolve NaN, Infinity ou não-inteiro', () => {
    for (const t of ['12,50', '1.5', '0,01', '999.999.999,99', 'x', '1,5,5']) {
      const r = parseMoney(t);
      if (r !== null) expect(Number.isSafeInteger(r)).toBe(true);
    }
  });
});

describe('resolveBackHref (regressão do open redirect)', () => {
  it('mantém caminho interno, aceita array e cai no fallback para destinos externos', () => {
    expect(resolveBackHref('/carteira?mes=2026-11', '/inicio')).toBe('/carteira?mes=2026-11');
    expect(resolveBackHref(['/acertos', '/x'], '/inicio')).toBe('/acertos');
    expect(resolveBackHref('//evil.com', '/inicio')).toBe('/inicio');
    expect(resolveBackHref('/\\evil.com', '/inicio')).toBe('/inicio');
    expect(resolveBackHref('/sair', '/inicio')).toBe('/inicio');
    expect(resolveBackHref('https://evil.com', '/inicio')).toBe('/inicio');
    expect(resolveBackHref(undefined, '/inicio')).toBe('/inicio');
  });
});
