import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { OAUTH_STATE_PATTERN, type OAuthProvider } from '@tostao/contracts';

export const OAUTH_COOKIE = 'tostao_oauth';
export const API_URL = process.env.API_URL ?? 'http://localhost:3333';
const COOKIE_PATH = '/api/auth';
const COOKIE_TTL_SECONDS = 60 * 10;
export const INVITE_CODE_MAX = 32;

type From = 'entrar' | 'criar-conta';

/** O cookie só amarra o retorno ao MESMO navegador (state). Nonce e PKCE ficam no servidor da API. */
export type OAuthCookiePayload = {
  provider: OAuthProvider;
  state: string;
  from: From;
  inviteCode?: string;
};

export function parseProvider(raw: string): OAuthProvider | null {
  if (raw === 'google' || raw === 'apple') return raw;
  return null;
}

export function sanitizeFrom(raw: string | null | undefined): From {
  return raw === 'criar-conta' ? 'criar-conta' : 'entrar';
}

/** Código de convite: curto e só com caracteres comuns. Qualquer outra coisa vira "sem convite". */
export function sanitizeInviteCode(raw: string | null | undefined): string | undefined {
  const v = raw?.trim();
  return v && v.length <= INVITE_CODE_MAX && /^[A-Za-z0-9_-]+$/.test(v) ? v : undefined;
}

// ---------- cookie assinado (HMAC-SHA256) ----------
// Sem OAUTH_COOKIE_SECRET em produção o login social fica desligado (melhor que um cookie forjável).
// Fora de produção cai num segredo aleatório do processo, só pra dev funcionar sem configurar.
const DEV_SECRET = randomBytes(32).toString('hex');

function cookieSecret(): string | null {
  const configured = process.env.OAUTH_COOKIE_SECRET;
  if (configured && configured.length >= 32) return configured;
  return process.env.NODE_ENV === 'production' ? null : DEV_SECRET;
}

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest();

/** string assinada "payload.assinatura" (base64url), ou null se não há segredo configurado. */
export function signOAuthCookie(payload: OAuthCookiePayload, nowMs = Date.now()): string | null {
  const secret = cookieSecret();
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(nowMs / 1000) + COOKIE_TTL_SECONDS })).toString(
    'base64url',
  );
  return `${body}.${hmac(secret, body).toString('base64url')}`;
}

/** Só devolve o payload se a assinatura bate, não venceu e os campos têm o formato esperado. */
export function readOAuthCookie(raw: string | undefined, nowMs = Date.now()): OAuthCookiePayload | null {
  const secret = cookieSecret();
  if (!raw || !secret) return null;
  const [body, signature, extra] = raw.split('.');
  if (!body || !signature || extra !== undefined) return null;
  const expected = hmac(secret, body);
  const got = Buffer.from(signature, 'base64url');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
    const provider = typeof data.provider === 'string' ? parseProvider(data.provider) : null;
    if (!provider || typeof data.state !== 'string' || !OAUTH_STATE_PATTERN.test(data.state)) return null;
    if (typeof data.exp !== 'number' || data.exp * 1000 < nowMs) return null;
    return {
      provider,
      state: data.state,
      from: sanitizeFrom(typeof data.from === 'string' ? data.from : null),
      inviteCode: sanitizeInviteCode(typeof data.inviteCode === 'string' ? data.inviteCode : null),
    };
  } catch {
    return null;
  }
}

/** Mesmos atributos na ida e na volta: a Apple (form_post cross-site) exige SameSite=None + Secure em HTTPS. */
export function oauthCookieAttrs(provider: OAuthProvider | null, isHttps: boolean) {
  return {
    httpOnly: true,
    sameSite: provider === 'apple' && isHttps ? ('none' as const) : ('lax' as const),
    secure: isHttps,
    path: COOKIE_PATH,
  };
}

export function setOAuthCookie(res: NextResponse, value: string, provider: OAuthProvider, isHttps: boolean) {
  res.cookies.set(OAUTH_COOKIE, value, { ...oauthCookieAttrs(provider, isHttps), maxAge: COOKIE_TTL_SECONDS });
}

/** Apagar = escrever vazio e vencido, com os MESMOS atributos de quando foi criado (senão o navegador pode ignorar). */
export function clearOAuthCookie(res: NextResponse, provider: OAuthProvider | null, isHttps: boolean) {
  res.cookies.set(OAUTH_COOKIE, '', { ...oauthCookieAttrs(provider, isHttps), maxAge: 0 });
}

// ---------- origem pública ----------
/**
 * Origem que o navegador usa, pra montar a redirect_uri.
 * Em PRODUÇÃO vem só de APP_PUBLIC_URL: x-forwarded-host e Host são cabeçalhos que quem faz a requisição controla
 * (Host Header Injection poderia apontar o redirect pra um domínio do atacante).
 * Fora de produção respeita o host/proxy pra facilitar localhost e túneis.
 * null = produção sem APP_PUBLIC_URL válida.
 */
export function resolvePublicOrigin(request: NextRequest): { origin: string; isHttps: boolean } | null {
  if (process.env.NODE_ENV === 'production') {
    try {
      const url = new URL(process.env.APP_PUBLIC_URL ?? '');
      if (url.protocol !== 'https:') return null;
      return { origin: url.origin, isHttps: true };
    } catch {
      return null;
    }
  }

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

export function misconfigured() {
  console.error('[oauth] APP_PUBLIC_URL (https) e OAUTH_COOKIE_SECRET (32+ caracteres) são obrigatórios em produção.');
  return new NextResponse('Login social indisponível no momento.', { status: 503 });
}

export function redirectWithOAuthError(
  origin: string,
  from: From,
  code: string,
  inviteCode?: string,
  status: 302 | 303 = 303,
  cookie?: { provider: OAuthProvider | null; isHttps: boolean },
) {
  const dest = new URL(`/${from}`, origin);
  dest.searchParams.set('oauthError', code);
  const invite = sanitizeInviteCode(inviteCode);
  if (from === 'criar-conta' && invite) {
    dest.searchParams.set('convite', invite);
  }
  const res = NextResponse.redirect(dest, status);
  clearOAuthCookie(res, cookie?.provider ?? null, cookie?.isHttps ?? false);
  return res;
}
