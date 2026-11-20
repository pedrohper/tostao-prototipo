import { describe, expect, it } from 'vitest';
import { categorizeByProviderCategory, categorizeByRules, patternFromDescription } from './categorize.js';
import type { CategoryRule } from '../domain/entities.js';

const rule = (pattern: string, categoryId: string, userId: string | null = null): CategoryRule => ({
  id: pattern,
  userId,
  pattern,
  categoryId,
});

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
  it('também reconhece regra pelo merchantName vindo do provedor', () => {
    expect(categorizeByRules('DL*VIAGEM APP', rules, 'Uber')).toBe('transporte');
  });
  it('regra criada de descrição com data no meio bate na próxima', () => {
    const r = rule(patternFromDescription('PIX ENVIADO - DES FULANO DE TAL 02/09 - DOCTO: 1757'), 'nao-conta', 'u1');
    expect(categorizeByRules('PIX ENVIADO - DES FULANO DE TAL 21/10 - DOCTO: 1635', [r])).toBe('nao-conta');
  });
});

describe('categorizeByProviderCategory', () => {
  it('mapeia categorias inequívocas respeitando entrada vs saída', () => {
    expect(categorizeByProviderCategory('Taxi and ride-hailing', -2500)).toBe('transporte');
    expect(categorizeByProviderCategory('Food delivery', -4290)).toBe('delivery');
    expect(categorizeByProviderCategory('Eating out', -3100)).toBe('comer-fora');
    expect(categorizeByProviderCategory('Video streaming', -5590)).toBe('assinaturas');
    expect(categorizeByProviderCategory('Salary', 500000)).toBe('salario');
    expect(categorizeByProviderCategory('Proceeds interests and dividends', 1200)).toBe('entrada-outros');
  });

  it('não chuta em categorias genéricas ou quando o sinal não combina', () => {
    expect(categorizeByProviderCategory('Services', -2500)).toBeNull();
    expect(categorizeByProviderCategory('Transfer - PIX', -2500)).toBeNull();
    expect(categorizeByProviderCategory('Salary', -5000)).toBeNull();
    expect(categorizeByProviderCategory('Taxi and ride-hailing', 2500)).toBeNull();
  });
});

describe('patternFromDescription', () => {
  it('tira números que mudam a cada compra', () => {
    expect(patternFromDescription('Uber *Trip 8821')).toBe('UBER *TRIP');
    expect(patternFromDescription('PAG*RESTAURANTESABOR 12/03')).toBe('PAG*RESTAURANTESABOR');
  });
});
