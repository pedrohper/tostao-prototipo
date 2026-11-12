// Sessão que renova sozinha. O token vale 7 dias; quando passa de 1 dia de idade,
// trocamos por um novo em segundo plano. Quem usa o app toda semana nunca cai pro login.
import { NextResponse, type NextRequest } from 'next/server';
import { TOKEN_COOKIE } from './lib/session-constants';

const API_URL = process.env.API_URL ?? 'http://localhost:3333';
const ONE_DAY = 24 * 60 * 60;

function issuedAt(token: string): number | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString());
    return typeof payload.iat === 'number' ? payload.iat : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const iat = token ? issuedAt(token) : null;
  if (!token || iat === null || Date.now() / 1000 - iat < ONE_DAY) return NextResponse.next();

  try {
    const res = await fetch(`${API_URL}/sessions/refresh`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return NextResponse.next(); // expirado: a página manda pro login como sempre
    const { token: fresh } = (await res.json()) as { token: string };
    request.cookies.set(TOKEN_COOKIE, fresh); // a página desta requisição já usa o novo
    const response = NextResponse.next({ request });
    response.cookies.set(TOKEN_COOKIE, fresh, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * ONE_DAY,
    });
    return response;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/|elenco/|icones/|favicon|manifest|.*\\.(?:png|webp|svg|ico|json)$).*)'],
};
