// Sessão que renova sozinha. O access token dura 15 min; quando falta pouco (ou o cookie já expirou), trocamos o
// refresh token por um par novo em segundo plano. Quem usa o app nunca cai pro login enquanto a sessão de 30 dias valer.
import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_MAX_AGE_SECONDS,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  TOKEN_COOKIE,
  sessionCookieOptions,
} from './lib/session-constants';
import { refreshSession } from './lib/refresh-session';
import { shouldRefresh } from './lib/token-expiry';
import { clientIpFromHeaders } from './lib/client-ip';

export async function proxy(request: NextRequest) {
  const access = request.cookies.get(TOKEN_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!shouldRefresh({ access, refresh, nowSeconds: Math.floor(Date.now() / 1000) })) return NextResponse.next();

  const result = await refreshSession(refresh!, { clientIp: clientIpFromHeaders((n) => request.headers.get(n)) });
  if (result.status === 'unavailable') return NextResponse.next(); // API fora: a página decide (sem apagar nada)

  if (result.status === 'invalid') {
    // Refresh recusado (vencido, revogado, reusado): a sessão acabou. Limpa pra não tentar de novo a cada requisição.
    request.cookies.delete(TOKEN_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    const response = NextResponse.next({ request });
    response.cookies.delete(TOKEN_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  request.cookies.set(TOKEN_COOKIE, result.accessToken); // a página desta requisição já usa o novo
  request.cookies.set(REFRESH_COOKIE, result.refreshToken);
  const response = NextResponse.next({ request });
  response.cookies.set(TOKEN_COOKIE, result.accessToken, sessionCookieOptions(ACCESS_MAX_AGE_SECONDS));
  response.cookies.set(REFRESH_COOKIE, result.refreshToken, sessionCookieOptions(REFRESH_MAX_AGE_SECONDS));
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/|api/auth/|sair$|sw\\.js$|elenco/|icones/|favicon|manifest|.*\\.(?:png|webp|svg|ico|json)$).*)',
  ],
};
