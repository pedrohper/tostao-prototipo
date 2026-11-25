import { describe, expect, it } from 'vitest';
import { hasTechnicalLeak, humanizeWidgetError } from './conectar-widget';

describe('humanizeWidgetError (T6.5)', () => {
  const technicalCases: Array<[string, 'token' | 'init' | 'widget' | 'connect']> = [
    ['Não consegui abrir a conexão com o banco agora (500).', 'token'],
    ['Pluggy recusou as credenciais (401). Confere o client id e o secret.', 'token'],
    ['NetworkError: Failed to fetch', 'token'],
    ['Invalid connect_token on PluggyConnect SDK', 'widget'],
    ['Error 502 Bad Gateway', 'init'],
    ['Pluggy respondeu 500 em /items/3f1c2a9e.', 'connect'],
    ['Esse Item ID não existe ou expirou no Pluggy.', 'connect'],
    ['Item ID inválido.', 'connect'],
    ['Essa conexão não pertence à sua conta. Conecte pelo botão do app.', 'connect'],
    ['Essa conexão não está disponível.', 'connect'],
    ['Esse banco é só de teste e não pode ser conectado.', 'connect'],
  ];

  it.each(technicalCases)('não expõe detalhes técnicos para: %s', (raw, reason) => {
    const out = humanizeWidgetError(raw, reason);
    expect(out.length).toBeGreaterThan(20);
    expect(hasTechnicalLeak(out)).toBe(false);
    expect(out).not.toMatch(/Item ID|PluggyConnect|clientUserId|connect_token|500|401|502|404/i);
  });

  it('mantém aviso claro para vínculo já usado ou de outra conta sem citar Item ID', () => {
    const out = humanizeWidgetError('Essa conexão não pertence à sua conta.', 'connect');
    expect(out).toContain('outra conta');
    expect(hasTechnicalLeak(out)).toBe(false);
  });

  it('trata erro vazio ou nulo com mensagem humana padrão', () => {
    const out = humanizeWidgetError(null, 'init');
    expect(out).toContain('Não deu pra conectar seu banco agora');
    expect(hasTechnicalLeak(out)).toBe(false);
  });
});
