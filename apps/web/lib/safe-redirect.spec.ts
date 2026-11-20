import { describe, expect, it } from 'vitest';
import { InvalidPathSegmentError, isSafePathSegment, safeInternalPath, safePathSegment } from './safe-redirect';

const FB = '/carteira';

describe('safeInternalPath', () => {
  it.each([
    ['/carteira?mes=2026-11', '/carteira?mes=2026-11'],
    ['/carteira/abc-123?voltar=%2Finicio&erro=nota', '/carteira/abc-123?voltar=%2Finicio&erro=nota'],
    ['/inicio', '/inicio'],
    ['/acertos#topo', '/acertos#topo'],
    ['/', '/'],
  ])('aceita caminho interno %s', (raw, expected) => {
    expect(safeInternalPath(raw, FB)).toBe(expected);
  });

  it.each([
    ['https://evil.com'],
    ['http://evil.com/x'],
    ['//evil.com'],
    ['///evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['/\\/evil.com'],
    ['javascript:alert(1)'],
    ['data:text/html,<script>1</script>'],
    ['evil.com'],
    ['carteira'],
    [' /carteira'],
    ['/\tevil.com'],
    ['/\n/evil.com'],
    ['/\r\nSet-Cookie: x=1'],
    ['/\u0000evil'],
    ['/\u007f'],
    [''],
  ])('rejeita %j e devolve o fallback', (raw) => {
    expect(safeInternalPath(raw, FB)).toBe(FB);
  });

  it.each([
    ['/sair'],
    ['/sair?x=1'],
    ['/sair/'],
    ['/SAIR'],
    ['/api/auth/google/start'],
    ['/api'],
    ['/api?x=1'],
    ['/./sair'],
    ['/carteira/../sair'],
    ['/%73air'],
    ['/%61pi/x'],
  ])('bloqueia rota sensível %s', (raw) => {
    expect(safeInternalPath(raw, FB)).toBe(FB);
  });

  it('não bloqueia rotas que só começam parecido (/sairmais não é /sair)', () => {
    expect(safeInternalPath('/sairmais', FB)).toBe('/sairmais');
    expect(safeInternalPath('/apis-publicas', FB)).toBe('/apis-publicas');
  });

  it('rejeita percent-encoding inválido no caminho', () => {
    expect(safeInternalPath('/%E0%A4%A', FB)).toBe(FB);
  });

  it.each([[null], [undefined], [42], [{}], [['/inicio']]])('valor que não é string (%j) -> fallback', (raw) => {
    expect(safeInternalPath(raw, FB)).toBe(FB);
  });

  it('usa o fallback informado', () => {
    expect(safeInternalPath('//evil.com', '/inicio')).toBe('/inicio');
  });

  it('o resultado nunca sai da origem: sempre começa com uma única "/"', () => {
    for (const raw of ['/a', '/a/b?c=d', '/%2Fevil.com', '/%5Cevil.com', '/@evil.com', '/.evil.com']) {
      const out = safeInternalPath(raw, FB);
      expect(out.startsWith('/')).toBe(true);
      expect(out.startsWith('//')).toBe(false);
      expect(out.includes('\\')).toBe(false);
    }
  });
});

describe('safePathSegment', () => {
  it.each([['3fa85f64-5717-4562-b3fc-2c963f66afa6'], ['nao-conta'], ['delivery'], ['m1_l2'], ['a'], ['A'.repeat(64)]])(
    'aceita %s',
    (id) => {
      expect(safePathSegment(id)).toBe(id);
      expect(isSafePathSegment(id)).toBe(true);
    },
  );

  it.each([
    ['../me/delete'],
    ['..'],
    ['.'],
    ['abc?x=1'],
    ['abc#frag'],
    ['a/b'],
    ['a\\b'],
    ['abc def'],
    ['abc%2F..%2Fme'],
    ['%2e%2e'],
    ['é'],
    ['a'.repeat(65)],
    [''],
    ['abc\n'],
  ])('rejeita %j', (id) => {
    expect(() => safePathSegment(id)).toThrow(InvalidPathSegmentError);
    expect(isSafePathSegment(id)).toBe(false);
  });

  it.each([[null], [undefined], [123], [{}], [['a']], [new File([], 'x')]])('rejeita não-string (%#)', (id) => {
    expect(() => safePathSegment(id)).toThrow(InvalidPathSegmentError);
  });

  it('o resultado nunca contém caracteres que mudam o caminho da requisição', () => {
    const out = safePathSegment('abc-123_X');
    expect(out).toBe(encodeURIComponent(out));
    expect(`/transactions/${out}/category`).toBe('/transactions/abc-123_X/category');
  });
});
