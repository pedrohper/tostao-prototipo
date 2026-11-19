import { NextResponse, type NextRequest } from 'next/server';
import type { OAuthProvider } from '@tostao/contracts';

export const OAUTH_COOKIE = 'tostao_oauth';
export const API_URL = process.env.API_URL ?? 'http://localhost:3333';

export type OAuthCookiePayload = {
  provider: OAuthProvider;
  state: string;
  nonce: string;
  codeVerifier?: string;
  from: 'entrar' | 'criar-conta';
  inviteCode?: string;
};

export function parseProvider(raw: string): OAuthProvider | null {
  if (raw === 'google' || raw === 'apple') return raw;
  return null;
}

export function sanitizeFrom(raw: string | null | undefined): 'entrar' | 'criar-conta' {
  return raw === 'criar-conta' ? 'criar-conta' : 'entrar';
}

/**
 * Descobre a origem pública que o navegador usou (respeitando Tailscale Funnel / reverse proxy via x-forwarded-*).
 * Assim a redirect_uri bate exatamente com o domínio público e o localhost no dev.
 */
export function resolvePublicOrigin(request: NextRequest): { origin: string; isHttps: boolean } {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();

  if (host) {
    const proto =
      forwardedProto === 'https' || forwardedProto === 'http'
        ? forwardedProto
        : request.nextUrl.protocol.replace(':', '') || 'http';
    return { origin: `${proto}://${host}`, isHttps: proto === 'https' };
  }

  const origin = request.nextUrl.origin;
  return { origin, isHttps: origin.startsWith('https://') };
}

export function redirectWithOAuthError(
  origin: string,
  from: 'entrar' | 'criar-conta',
  code: string,
  inviteCode?: string,
  status: 302 | 303 = 303,
) {
  const dest = new URL(`/${from}`, origin);
  dest.searchParams.set('oauthError', code);
  if (from === 'criar-conta' && inviteCode) {
    dest.searchParams.set('convite', inviteCode);
  }
  const res = NextResponse.redirect(dest, status);
  res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' });
  return res;
}
