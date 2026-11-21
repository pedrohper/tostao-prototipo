// GET /sair: limpeza LOCAL da sessão quando ela vence (api() redireciona pra cá). Não chama a API e não revoga nada.
// O "sair" de verdade (revoga o refresh token) é a Server Action `logout` em lib/session-actions.ts, que só roda
// por POST com checagem de origem do Next (CSRF-safe). Como GET é navegável de qualquer site (<img src="/sair">),
// requisição vinda de OUTRO site (Sec-Fetch-Site: cross-site) não limpa nada: só cai no login.
import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE, TOKEN_COOKIE } from '@/lib/session-constants';
import { resolvePublicOrigin } from '@/lib/oauth';

export async function GET(request: NextRequest) {
  // Atrás de proxy reverso, request.url pode ser http://127.0.0.1:3000: o destino vem de APP_PUBLIC_URL em produção.
  const origin = resolvePublicOrigin(request)?.origin ?? request.nextUrl.origin;
  const res = NextResponse.redirect(new URL('/entrar', origin));
  if (request.headers.get('sec-fetch-site') === 'cross-site') return res;
  res.cookies.delete(TOKEN_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
