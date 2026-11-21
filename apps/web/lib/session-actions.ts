'use server';
// Sair de verdade: revoga o refresh token na API (a sessão morre no servidor, não só no navegador) e limpa os cookies.
// Server Action = só POST, e o Next confere Origin/Host: um site de fora não consegue deslogar a pessoa (logout CSRF).
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientIpFromHeaders, forwardedForHeader } from './client-ip';
import { rethrowIfRedirect } from './rethrow';
import { getRefreshToken, clearSession } from './session';

const API_URL = process.env.API_URL ?? 'http://localhost:3333';

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  const h = await headers();
  if (refreshToken) {
    try {
      await fetch(`${API_URL}/sessions/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...forwardedForHeader(clientIpFromHeaders((n) => h.get(n))),
        },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
    } catch (e) {
      rethrowIfRedirect(e);
      // Melhor esforço: com a API fora do ar a pessoa ainda sai deste navegador (o token morre sozinho em 30 dias).
    }
  }
  await clearSession();
  redirect('/entrar');
}
