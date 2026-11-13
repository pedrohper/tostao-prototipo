import { describe, expect, it } from 'vitest';
import { parseAmountToCents, parseExpense } from './parse-expense.js';

describe('parseExpense', () => {
  it('entende os jeitos comuns', () => {
    expect(parseExpense('gastei 25 no ifood')).toEqual({ kind: 'saida', amountInCents: 2500, description: 'Ifood', daysAgo: 0 });
    expect(parseExpense('Paguei R$ 32,50 de uber ontem')).toEqual({ kind: 'saida', amountInCents: 3250, description: 'Uber', daysAgo: 1 });
    expect(parseExpense('recebi 100 reais do pai')).toEqual({ kind: 'entrada', amountInCents: 10000, description: 'Pai', daysAgo: 0 });
    expect(parseExpense('comprei 1.234,56 numa tv')).toMatchObject({ amountInCents: 123456, description: 'Tv' });
    expect(parseExpense('gastei 12')).toMatchObject({ amountInCents: 1200, description: 'Anotado pelo WhatsApp' });
    expect(parseExpense('ontem gastei 40 conto com lanche')).toMatchObject({ amountInCents: 4000, description: 'Lanche', daysAgo: 1 });
  });

  it('pergunta não vira gasto', () => {
    expect(parseExpense('quanto gastei com delivery?')).toBeNull();
    expect(parseExpense('gastei muito esse mês')).toBeNull();
    expect(parseExpense('gastei 0 hoje')).toBeNull();
    expect(parseExpense('123456')).toBeNull();
  });

  it('valores', () => {
    expect(parseAmountToCents('25.5')).toBe(2550);
    expect(parseAmountToCents('1.000')).toBe(100000);
  });
});
