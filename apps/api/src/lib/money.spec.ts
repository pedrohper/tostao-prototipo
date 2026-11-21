import { describe, expect, it } from 'vitest';
import { toBigCents, toCents, toCentsOrNull } from './money.js';

describe('lib/money: ponte bigint <-> number', () => {
  it('ida e volta sem perda dentro da faixa segura, inclusive R$ 100 milhões e negativos', () => {
    for (const n of [0, 1, -1, 123456, -999_999_999, 10_000_000_000, -10_000_000_000, Number.MAX_SAFE_INTEGER]) {
      expect(toCents(toBigCents(n))).toBe(n);
    }
  });

  it('acima de Number.MAX_SAFE_INTEGER falha alto em vez de arredondar', () => {
    expect(() => toCents(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
    expect(() => toCents(BigInt(Number.MIN_SAFE_INTEGER) - 1n)).toThrow(RangeError);
  });

  it('não grava número que não é inteiro seguro', () => {
    for (const bad of [1.5, NaN, Infinity, 2 ** 53]) expect(() => toBigCents(bad)).toThrow(RangeError);
  });

  it('null passa como null', () => {
    expect(toCentsOrNull(null)).toBeNull();
    expect(toCentsOrNull(5n)).toBe(5);
  });
});
