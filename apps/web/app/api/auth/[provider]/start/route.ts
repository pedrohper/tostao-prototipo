import { createHash, randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import type { OAuthStartResponse } from '@tostao/contracts';
import {
  API_URL,
  OAUTH_COOKIE,
  parseProvider,
  redirectWithOAuthError,
  resolvePublicOrigin,
  sanitizeFrom,
  type OAuthCookiePayload,
} from '@/lib/oauth';

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = parseProvider(rawProvider);
  const { origin, isHttps } = resolvePublicOrigin(request);
  const from = sanitizeFrom(request.nextUrl.searchParams.get('from'));
  const inviteCode = request.nextUrl.searchParams.get('convite')?.trim() || undefined;

  if (!provider) {
    return redirectWithOAuthError(origin, from, 'oauth_failed', inviteCode, 302);
  }

  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const codeVerifier = provider === 'google' ? randomBytes(32).toString('base64url') : undefined;
  const codeChallenge = codeVerifier ? createHash('sha256').update(codeVerifier).digest('base64url') : undefined;
  const redirectUri = `${origin}/api/auth/${provider}/callback`;

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/oauth/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider, redirectUri, state, nonce, codeChallenge }),
      cache: 'no-store',
    });
  } catch {
    return redirectWithOAuthError(origin, from, 'oauth_failed', inviteCode, 302);
  }

  if (apiRes.status === 503) {
    return redirectWithOAuthError(origin, from, `unconfigured_${provider}`, inviteCode, 302);
  }
  if (!apiRes.ok) {
    return redirectWithOAuthError(origin, from, 'oauth_failed', inviteCode, 302);
  }

  const { url } = (await apiRes.json()) as OAuthStartResponse;
  const payload: OAuthCookiePayload = {
    provider,
    state,
    nonce,
    codeVerifier,
    from,
    inviteCode,
  };

  const response = NextResponse.redirect(url, 302);
  // Apple usa response_mode=form_post (POST cross-site): precisa de SameSite=None + Secure em HTTPS.
  response.cookies.set(OAUTH_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: provider === 'apple' && isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/api/auth',
    maxAge: 60 * 10,
  });
  return response;
}
