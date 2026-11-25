// T6.16 · validação e forma canônica da chave Pix. Todos os documentos aqui são fictícios.
import { describe, expect, it } from 'vitest';
import { isValidCnpj, isValidCpf, normalizePixKey, pixKeyBody, pixKeyTypeOf } from './pix';

describe('CPF e CNPJ', () => {
  it('confere os dígitos verificadores', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('52998224724')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false); // sequência repetida passa na conta, mas não existe
    expect(isValidCpf('5299822472')).toBe(false);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
  });

  it('aceita com máscara e guarda só os dígitos', () => {
    expect(normalizePixKey('cpf', ' 529.982.247-25 ')).toBe('52998224725');
    expect(normalizePixKey('cnpj', '11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizePixKey('cpf', 'cpf 529.982.247-25')).toBeNull(); // texto no meio não é limpado em silêncio
  });
});

describe('e-mail, celular e chave aleatória', () => {
  it('e-mail em minúsculas e até 77 caracteres', () => {
    expect(normalizePixKey('email', ' Fulano@Exemplo.COM.br ')).toBe('fulano@exemplo.com.br');
    expect(normalizePixKey('email', 'sem-arroba.com')).toBeNull();
    expect(normalizePixKey('email', 'joão@exemplo.com')).toBeNull();
    const dominio = '@exemplo.com';
    expect(normalizePixKey('email', `${'a'.repeat(77 - dominio.length)}${dominio}`)).not.toBeNull();
    expect(normalizePixKey('email', `${'a'.repeat(78 - dominio.length)}${dominio}`)).toBeNull();
  });

  it('celular vira +55DDDNÚMERO', () => {
    for (const raw of ['11 91234-5678', '(11) 91234-5678', '+55 11 91234-5678', '5511912345678', '+5511912345678']) {
      expect(normalizePixKey('telefone', raw)).toBe('+5511912345678');
    }
    expect(normalizePixKey('telefone', '55 91234-5678')).toBe('+5555912345678'); // DDD 55 não é confundido com o país
    expect(normalizePixKey('telefone', '11 3123-4567')).toBeNull(); // fixo
    expect(normalizePixKey('telefone', '+1 11912345678')).toBeNull();
    expect(normalizePixKey('telefone', '+11912345678')).toBeNull(); // com "+" precisa do 55
    expect(normalizePixKey('telefone', '91234-5678')).toBeNull(); // sem DDD
  });

  it('chave aleatória é um UUID, em minúsculas', () => {
    expect(normalizePixKey('aleatoria', '123E4567-E12B-12D1-A456-426655440000')).toBe(
      '123e4567-e12b-12d1-a456-426655440000',
    );
    expect(normalizePixKey('aleatoria', '123e4567e12b12d1a456426655440000')).toBeNull();
  });

  it('o tipo sai da forma guardada', () => {
    expect(pixKeyTypeOf('52998224725')).toBe('cpf');
    expect(pixKeyTypeOf('11222333000181')).toBe('cnpj');
    expect(pixKeyTypeOf('a@b.com')).toBe('email');
    expect(pixKeyTypeOf('+5511912345678')).toBe('telefone');
    expect(pixKeyTypeOf('123e4567-e12b-12d1-a456-426655440000')).toBe('aleatoria');
    expect(pixKeyTypeOf('qualquer coisa')).toBeNull();
  });
});

describe('pixKeyBody', () => {
  it('devolve a chave já normalizada', () => {
    expect(pixKeyBody.parse({ type: 'cpf', key: '529.982.247-25' })).toEqual({ type: 'cpf', key: '52998224725' });
  });

  it('erra com mensagem do tipo escolhido, sem repetir a chave', () => {
    const res = pixKeyBody.safeParse({ type: 'cpf', key: '123.456.789-00' });
    expect(res.success).toBe(false);
    expect(res.error!.issues[0]!.message).toBe('Esse CPF não confere. Olha os números de novo.');
    expect(JSON.stringify(res.error!.issues)).not.toContain('123.456.789-00');
  });

  it('recusa tipo desconhecido, chave vazia e texto gigante', () => {
    expect(pixKeyBody.safeParse({ type: 'senha', key: 'x' }).success).toBe(false);
    expect(pixKeyBody.safeParse({ type: 'email', key: '   ' }).success).toBe(false);
    expect(pixKeyBody.safeParse({ type: 'email', key: 'a'.repeat(5000) }).success).toBe(false);
    expect(pixKeyBody.safeParse({}).success).toBe(false);
  });
});
