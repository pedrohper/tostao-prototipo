// Guardamos o JWT num cookie httpOnly: o JavaScript do navegador não consegue ler (protege contra XSS).
import { cookies } from 'next/headers';

export { TOKEN_COOKIE } from './session-constants';
import { TOKEN_COOKIE } from './session-constants';

export async function getToken() {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export async function setToken(token: string) {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // igual ao expiresIn do JWT na API
  });
}

export async function clearToken() {
  (await cookies()).delete(TOKEN_COOKIE);
}
