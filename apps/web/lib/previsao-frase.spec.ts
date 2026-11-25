import { describe, expect, it } from 'vitest';
import { getDictionary } from './i18n';

describe('frase da previsão quando os três meses fecham no azul', () => {
  it.each(['pt-BR', 'en', 'es'] as const)('%s mostra o valor que deve sobrar', (locale) => {
    const phrase = getDictionary(locale).pages.previsao.allGreen('dezembro', 'R$ 120,00');
    expect(phrase).toContain('R$ 120,00');
    expect(phrase).toContain('dezembro');
  });
});
