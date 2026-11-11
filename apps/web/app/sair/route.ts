// GET /sair: apaga o cookie e volta pro login. Usado também quando o token expira.
import { NextResponse } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/session';

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL('/entrar', request.url));
  res.cookies.delete(TOKEN_COOKIE);
  return res;
}
