// Guardamos a sessão em cookies httpOnly: o JavaScript do navegador não consegue ler (protege contra XSS).
import { cookies } from 'next/headers';
import {
  ACCESS_MAX_AGE_SECONDS,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  TOKEN_COOKIE,
  sessionCookieOptions,
  type SessionTokens,
} from './session-constants';

export { TOKEN_COOKIE, REFRESH_COOKIE } from './session-constants';

export async function getToken() {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

export async function setSession({ accessToken, refreshToken }: SessionTokens) {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, accessToken, sessionCookieOptions(ACCESS_MAX_AGE_SECONDS));
  jar.set(REFRESH_COOKIE, refreshToken, sessionCookieOptions(REFRESH_MAX_AGE_SECONDS));
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
