import { describe, expect, it } from 'vitest';
import { REFRESH_SKEW_SECONDS, accessTokenExp, shouldRefresh } from './token-expiry';

const jwt = (payload: object) =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
const NOW = 1_800_000_000;

describe('accessTokenExp', () => {
  it('lê o exp; lixo vira null', () => {
    expect(accessTokenExp(jwt({ exp: 123 }))).toBe(123);
    expect(accessTokenExp(jwt({ iat: 1 }))).toBeNull();
    expect(accessTokenExp(jwt({ exp: 'amanhã' }))).toBeNull();
    expect(accessTokenExp('lixo')).toBeNull();
    expect(accessTokenExp('')).toBeNull();
  });
});

describe('shouldRefresh', () => {
  it('sem refresh token nunca renova (cookie de access forjado, sozinho, não gera chamada à API)', () => {
    expect(shouldRefresh({ access: jwt({ exp: 1 }), refresh: undefined, nowSeconds: NOW })).toBe(false);
    expect(shouldRefresh({ access: jwt({ iat: 0 }), refresh: undefined, nowSeconds: NOW })).toBe(false);
    expect(shouldRefresh({ access: undefined, refresh: undefined, nowSeconds: NOW })).toBe(false);
  });

  it('access válido com folga: não renova', () => {
    expect(shouldRefresh({ access: jwt({ exp: NOW + 600 }), refresh: 'r', nowSeconds: NOW })).toBe(false);
    expect(shouldRefresh({ access: jwt({ exp: NOW + REFRESH_SKEW_SECONDS + 1 }), refresh: 'r', nowSeconds: NOW })).toBe(
      false,
    );
  });

  it('faltando 2 min ou menos, ou já vencido: renova', () => {
    expect(shouldRefresh({ access: jwt({ exp: NOW + REFRESH_SKEW_SECONDS }), refresh: 'r', nowSeconds: NOW })).toBe(
      true,
    );
    expect(shouldRefresh({ access: jwt({ exp: NOW + 30 }), refresh: 'r', nowSeconds: NOW })).toBe(true);
    expect(shouldRefresh({ access: jwt({ exp: NOW - 1 }), refresh: 'r', nowSeconds: NOW })).toBe(true);
  });

  it('cookie de access sumiu (expirou no navegador) ou ilegível, com refresh presente: renova', () => {
    expect(shouldRefresh({ access: undefined, refresh: 'r', nowSeconds: NOW })).toBe(true);
    expect(shouldRefresh({ access: 'lixo', refresh: 'r', nowSeconds: NOW })).toBe(true);
  });
});
