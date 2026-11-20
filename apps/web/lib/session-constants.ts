// Constantes da sessão, sem importar nada do Next (o proxy e os testes usam).
// Dois cookies httpOnly: o access token (JWT, 15 min) e o refresh token opaco (30 dias, revogável na API).
export const TOKEN_COOKIE = 'tostao_token';
export const REFRESH_COOKIE = 'tostao_refresh';

export const ACCESS_MAX_AGE_SECONDS = 15 * 60; // igual ao expiresIn do JWT na API
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // igual ao TTL do refresh token na API

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export type SessionTokens = { accessToken: string; refreshToken: string };
