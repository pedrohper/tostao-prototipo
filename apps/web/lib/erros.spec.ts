import { describe, expect, it } from 'vitest';
import { comErro, erroDe, ERROS } from './erros';

describe('erroDe', () => {
  it('traduz códigos conhecidos para o texto fixo', () => {
    expect(erroDe('nome_invalido')).toBe(ERROS.nome_invalido);
    expect(erroDe(['falha_salvar', 'x'])).toBe(ERROS.falha_salvar);
  });
  it('ignora texto livre, protótipos e valores que não são código (sem alerta forjado)', () => {
    expect(erroDe('Sua conta foi bloqueada, ligue 0800 123')).toBeUndefined();
    expect(erroDe('<script>alert(1)</script>')).toBeUndefined();
    expect(erroDe('toString')).toBeUndefined();
    expect(erroDe('__proto__')).toBeUndefined();
    expect(erroDe('constructor')).toBeUndefined();
    expect(erroDe(undefined)).toBeUndefined();
    expect(erroDe(42)).toBeUndefined();
  });
});

describe('comErro', () => {
  it('usa ? ou & conforme a URL', () => {
    expect(comErro('/acertos', 'dados_invalidos')).toBe('/acertos?erro=dados_invalidos');
    expect(comErro('/carteira/abc?voltar=%2Finicio', 'falha_salvar')).toBe(
      '/carteira/abc?voltar=%2Finicio&erro=falha_salvar',
    );
  });
});
