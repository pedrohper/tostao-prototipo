import { describe, expect, it } from 'vitest';
import { categorizeByRules, patternFromDescription } from './categorize.js';
import type { CategoryRule } from '../domain/entities.js';

const rule = (pattern: string, categoryId: string, userId: string | null = null): CategoryRule => ({ id: pattern, userId, pattern, categoryId });

describe('categorizeByRules', () => {
  const rules = [rule('IFD*', 'delivery'), rule('UBER', 'transporte'), rule('UBER *EATS', 'delivery')];

  it('acha a categoria ignorando maiúscula e acento', () => {
    expect(categorizeByRules('Ifd*Açaí do Zé', rules)).toBe('delivery');
  });
  it('devolve null quando nenhuma regra bate', () => {
    expect(categorizeByRules('PADARIA ESTRELA', rules)).toBeNull();
  });
  it('padrão mais específico vence', () => {
    expect(categorizeByRules('UBER *EATS PEDIDO', rules)).toBe('delivery');
  });
  it('regra do usuário vence regra do sistema', () => {
    expect(categorizeByRules('UBER *TRIP', [...rules, rule('UBER', 'estudo', 'u1')])).toBe('estudo');
  });
});

describe('patternFromDescription', () => {
  it('tira números que mudam a cada compra', () => {
    expect(patternFromDescription('Uber *Trip 8821')).toBe('UBER *TRIP');
    expect(patternFromDescription('PAG*RESTAURANTESABOR 12/03')).toBe('PAG*RESTAURANTESABOR');
  });
});
