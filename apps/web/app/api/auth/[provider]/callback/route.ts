import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { OAuthAuthResponse } from '@tostao/contracts';
import { TOKEN_COOKIE } from '@/lib/session-constants';
import {
  API_URL,
  OAUTH_COOKIE,
  parseProvider,
  redirectWithOAuthError,
  resolvePublicOrigin,
  type OAuthCookiePayload,
} from '@/lib/oauth';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function parseAppleUserName(rawUser: string | null): string | undefined {
  if (!rawUser) return undefined;
  try {
    const parsed = JSON.parse(rawUser) as { name?: { firstName?: string; lastName?: string } };
    const full = [parsed.name?.firstName, parsed.name?.lastName]
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim())
      .join(' ')
      .trim();
    return full || undefined;
  } catch {
    return undefined;
  }
}

async function handleCallback(
  request: NextRequest,
  rawProvider: string,
  params: { code?: string | null; state?: string | null; error?: string | null; user?: string | null },
) {
  const { origin, isHttps } = resolvePublicOrigin(request);
  const provider = parseProvider(rawProvider);

  const rawCookie = request.cookies.get(OAUTH_COOKIE)?.value;
  let cookie: OAuthCookiePayload | null = null;
  if (rawCookie) {
    try {
      cookie = JSON.parse(rawCookie) as OAuthCookiePayload;
    } catch {
      cookie = null;
    }
  }

  const from = cookie?.from ?? 'entrar';
  const inviteCode = cookie?.inviteCode;

  if (!provider) {
    return redirectWithOAuthError(origin, from, 'oauth_failed', inviteCode, 303);
  }

  if (params.error) {
    const cancelled = params.error === 'access_denied' || params.error === 'user_cancelled_authorize';
    return redirectWithOAuthError(origin, from, cancelled ? 'cancelled' : 'oauth_failed', inviteCode, 303);
  }

  if (
    !cookie ||
    cookie.provider !== provider ||
    !params.code ||
    !params.state ||
    !safeEqual(params.state, cookie.state)
  ) {
    return redirectWithOAuthError(origin, from, 'oauth_failed', inviteCode, 303);
  }

  const redirectUri = `${origin}/api/auth/${provider}/callback`;
  const name = provider === 'apple' ? parseAppleUserName(params.user ?? null) : undefined;

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        code: params.code,
        redirectUri,
        codeVerifier: cookie.codeVerifier,
        expectedNonce: cookie.nonce,
        name,
        inviteCode,
      }),
      cache: 'no-store',
    });
  } catch {
    return redirectWithOAuthError(origin, from, 'oauth_failed', inviteCode, 303);
  }

  if (!apiRes.ok) {
    const code =
      apiRes.status === 403 ? 'unverified_email' : apiRes.status === 503 ? `unconfigured_${provider}` : 'oauth_failed';
    return redirectWithOAuthError(origin, from, code, inviteCode, 303);
  }

  const { token, isNewUser } = (await apiRes.json()) as OAuthAuthResponse;
  const dest = new URL(isNewUser ? '/conectar?novo=1' : '/inicio', origin);
  // 303 See Other garante que o redirect pós-POST da Apple vire um GET de primeira parte com o cookie da sessão.
  const response = NextResponse.redirect(dest, 303);
  response.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth' });
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps || process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const sp = request.nextUrl.searchParams;
  return handleCallback(request, provider, {
    code: sp.get('code'),
    state: sp.get('state'),
    error: sp.get('error'),
    user: sp.get('user'),
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const form = await request.formData().catch(() => null);
  return handleCallback(request, provider, {
    code: form?.get('code')?.toString() ?? null,
    state: form?.get('state')?.toString() ?? null,
    error: form?.get('error')?.toString() ?? null,
    user: form?.get('user')?.toString() ?? null,
  });
}
