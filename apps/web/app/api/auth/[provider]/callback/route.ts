import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { OAuthAuthResponse } from '@tostao/contracts';
import { clientIpFromHeaders, forwardedForHeader } from '@/lib/client-ip';
import {
  ACCESS_MAX_AGE_SECONDS,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  TOKEN_COOKIE,
  sessionCookieOptions,
} from '@/lib/session-constants';
import {
  API_URL,
  clearOAuthCookie,
  misconfigured,
  OAUTH_COOKIE,
  parseProvider,
  readOAuthCookie,
  redirectWithOAuthError,
  resolvePublicOrigin,
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
    return full.slice(0, 120) || undefined;
  } catch {
    return undefined;
  }
}

async function handleCallback(
  request: NextRequest,
  rawProvider: string,
  params: { code?: string | null; state?: string | null; error?: string | null; user?: string | null },
) {
  const resolved = resolvePublicOrigin(request);
  if (!resolved) return misconfigured();
  const { origin, isHttps } = resolved;
  const provider = parseProvider(rawProvider);

  // Só vale cookie com assinatura correta e dentro do prazo. Adulterado ou ausente = null.
  const cookie = readOAuthCookie(request.cookies.get(OAUTH_COOKIE)?.value);

  const from = cookie?.from ?? 'entrar';
  const inviteCode = cookie?.inviteCode;
  const fail = (code: string) => redirectWithOAuthError(origin, from, code, inviteCode, 303, { provider, isHttps });

  if (!provider) return fail('oauth_failed');

  if (params.error) {
    const cancelled = params.error === 'access_denied' || params.error === 'user_cancelled_authorize';
    return fail(cancelled ? 'cancelled' : 'oauth_failed');
  }

  if (
    !cookie ||
    cookie.provider !== provider ||
    !params.code ||
    !params.state ||
    !safeEqual(params.state, cookie.state)
  ) {
    return fail('oauth_failed');
  }

  const redirectUri = `${origin}/api/auth/${provider}/callback`;
  const name = provider === 'apple' ? parseAppleUserName(params.user ?? null) : undefined;

  let apiRes: Response;
  try {
    // nonce, code_verifier e convite já estão na API, presos a este state. Só vai o que veio do provedor.
    apiRes = await fetch(`${API_URL}/auth/oauth/callback`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...forwardedForHeader(clientIpFromHeaders((n) => request.headers.get(n))),
      },
      body: JSON.stringify({ provider, code: params.code, state: params.state, redirectUri, name }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return fail('oauth_failed');
  }

  if (!apiRes.ok) {
    const code =
      apiRes.status === 403
        ? 'unverified_email'
        : apiRes.status === 409
          ? 'email_in_use_password'
          : apiRes.status === 503
            ? `unconfigured_${provider}`
            : 'oauth_failed';
    return fail(code);
  }

  const { accessToken, refreshToken, isNewUser } = (await apiRes.json()) as OAuthAuthResponse;
  const dest = new URL(isNewUser ? '/conectar?novo=1' : '/inicio', origin);
  // 303 See Other garante que o redirect pós-POST da Apple vire um GET de primeira parte com o cookie da sessão.
  const response = NextResponse.redirect(dest, 303);
  clearOAuthCookie(response, provider, isHttps);
  // `secure` também quando o retorno veio por HTTPS (a Apple devolve por POST cross-site em HTTPS).
  const secure = isHttps || process.env.NODE_ENV === 'production';
  response.cookies.set(TOKEN_COOKIE, accessToken, { ...sessionCookieOptions(ACCESS_MAX_AGE_SECONDS), secure });
  response.cookies.set(REFRESH_COOKIE, refreshToken, { ...sessionCookieOptions(REFRESH_MAX_AGE_SECONDS), secure });
  return response;
}

const notAllowed = (allow: 'GET' | 'POST') => new NextResponse(null, { status: 405, headers: { Allow: allow } });

// Google devolve por GET (query string); a Apple por POST (form_post). O outro método, em cada provedor, não existe.
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'google') return notAllowed('POST');
  const sp = request.nextUrl.searchParams;
  return handleCallback(request, provider, {
    code: sp.get('code'),
    state: sp.get('state'),
    error: sp.get('error'),
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'apple') return notAllowed('GET');
  const form = await request.formData().catch(() => null);
  return handleCallback(request, provider, {
    code: form?.get('code')?.toString() ?? null,
    state: form?.get('state')?.toString() ?? null,
    error: form?.get('error')?.toString() ?? null,
    user: form?.get('user')?.toString() ?? null,
  });
}
