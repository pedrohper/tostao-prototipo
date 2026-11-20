import { NextResponse, type NextRequest } from 'next/server';
import { clientIpFromHeaders, forwardedForHeader } from '@/lib/client-ip';
import type { OAuthStartResponse } from '@tostao/contracts';
import {
  API_URL,
  misconfigured,
  parseProvider,
  redirectWithOAuthError,
  resolvePublicOrigin,
  sanitizeFrom,
  sanitizeInviteCode,
  setOAuthCookie,
  signOAuthCookie,
} from '@/lib/oauth';

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = parseProvider(rawProvider);
  const resolved = resolvePublicOrigin(request);
  if (!resolved) return misconfigured();
  const { origin, isHttps } = resolved;
  const from = sanitizeFrom(request.nextUrl.searchParams.get('from'));
  const inviteCode = sanitizeInviteCode(request.nextUrl.searchParams.get('convite'));

  if (!provider) {
    return redirectWithOAuthError(origin, from, 'oauth_failed', inviteCode, 302);
  }

  const redirectUri = `${origin}/api/auth/${provider}/callback`;

  // state, nonce e PKCE são gerados e guardados pela API (uso único, 5 min). Aqui só vem o state de volta.
  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_URL}/auth/oauth/start`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...forwardedForHeader(clientIpFromHeaders((n) => request.headers.get(n))),
      },
      body: JSON.stringify({ provider, redirectUri, inviteCode, from }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
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

  const { url, state } = (await apiRes.json()) as OAuthStartResponse;
  const signed = signOAuthCookie({ provider, state, from, inviteCode });
  if (!signed) return misconfigured();

  const response = NextResponse.redirect(url, 302);
  setOAuthCookie(response, signed, provider, isHttps);
  return response;
}
