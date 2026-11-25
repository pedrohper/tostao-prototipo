'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readStoredHomePrefs, type HomePrefsPatch, type HomePrefsResponse } from '@tostao/contracts';
import { api } from './api';
import { flashToast } from './flash-toast-server';
import { PREFS_COOKIE, cacheCookie, legacyCookiePrefs } from './inicio-prefs';
import { rethrowIfRedirect } from './rethrow';
import { getToken } from './session';
import { accessTokenSub } from './token-expiry';

/**
 * Manda a mudança pra conta (sem mudança, só lê) e atualiza a cópia local. Se este aparelho ainda tem um cookie de antes
 * da T6.11, ele sobe junto e a conta decide: uma escolha que já está lá vence. O cookie antigo só é trocado depois que a
 * API confirma, então uma falha não perde nada.
 */
async function sendToAccount(change: Omit<HomePrefsPatch, 'migrar'>) {
  const [jar, token] = await Promise.all([cookies(), getToken()]);
  const migrar = legacyCookiePrefs(jar.get(PREFS_COOKIE)?.value);
  const patch = { ...change, ...(migrar ? { migrar } : {}) };
  const response = await api<HomePrefsResponse>(
    '/me/home-prefs',
    Object.keys(patch).length > 0 ? { method: 'PATCH', body: patch } : {},
  );
  if (response.prefs === undefined) throw new Error('Resposta inesperada de /me/home-prefs');
  const userId = token ? accessTokenSub(token) : null;
  const saved = readStoredHomePrefs(response.prefs);
  if (!saved || !userId) return jar.delete(PREFS_COOKIE);
  jar.set(PREFS_COOKIE, cacheCookie(saved, userId), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
}

/** Mudança feita num toque na Home: se não der pra salvar, avisa e deixa a tela como estava. */
async function changeFromHome(change: Omit<HomePrefsPatch, 'migrar'>, failure: string) {
  try {
    await sendToAccount(change);
  } catch (e) {
    rethrowIfRedirect(e);
    await flashToast(failure, 'error');
  }
  revalidatePath('/inicio');
}

/** Saves section order and hidden sections from the Customize Home screen. Only returns when it fails. */
export async function saveHomePrefs(order: string[], hidden: string[]): Promise<{ error: string }> {
  try {
    const { ordem, ocultos = [] } = readStoredHomePrefs({ ordem: order, ocultos: hidden })!;
    await sendToAccount({ layout: { ordem, ocultos } });
  } catch (e) {
    rethrowIfRedirect(e);
    return { error: 'Não consegui salvar agora. Sua escolha continua marcada: tenta de novo em instantes.' };
  }
  revalidatePath('/inicio');
  redirect('/inicio');
}

/** Restores all dismissed alerts on the Home screen. */
export async function restoreDismissedAlerts() {
  await changeFromHome({ restaurarAvisos: true }, 'Não consegui trazer os avisos de volta. Tenta de novo.');
}

/** Dismisses a specific alert key on the Home screen. */
export async function dismissAlert(key: string) {
  if (!key || key.length > 120) return;
  await changeFromHome({ fechar: [key] }, 'Não consegui fechar o aviso agora. Tenta de novo.');
}

/** Primeiro acesso depois da T6.11 (sobe o cookie antigo) ou cópia local atrasada. Silenciosa: falhou, tenta depois. */
export async function syncHomePrefs() {
  try {
    await sendToAccount({});
  } catch (e) {
    rethrowIfRedirect(e);
  }
}
