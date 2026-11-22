import { describe, expect, it } from 'vitest';
import { publicOrigin } from './public-origin';

const h = (o: Record<string, string>) => new Headers(o);
describe('publicOrigin', () => {
  it('APP_PUBLIC_URL manda; cabeçalho do proxy reverso é o plano B; localhost vira http', () => {
    expect(publicOrigin(h({ host: 'localhost:3000' }), 'https://tostao.exemplo.com/qualquer/caminho')).toBe(
      'https://tostao.exemplo.com',
    );
    expect(publicOrigin(h({ 'x-forwarded-host': 'tostao.exemplo.com, interno', 'x-forwarded-proto': 'https' }))).toBe(
      'https://tostao.exemplo.com',
    );
    expect(publicOrigin(h({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });
  it('Host com cara de ataque ou APP_PUBLIC_URL quebrada nunca vira destino de redirect', () => {
    expect(publicOrigin(h({ host: 'evil.com/@x' }))).toBe('https://localhost');
    expect(publicOrigin(h({ host: 'a b' }))).toBe('https://localhost');
    expect(publicOrigin(h({ host: 'ok.example.com' }), 'isso-nao-e-url')).toBe('https://ok.example.com');
  });
});
