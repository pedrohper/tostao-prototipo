'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PREFS_COOKIE, HOME_SECTIONS, parsePrefs, type HomePrefs } from './inicio-prefs';

async function updatePrefsCookie(updater: (prefs: HomePrefs) => HomePrefs) {
  const jar = await cookies();
  const next = updater(parsePrefs(jar.get(PREFS_COOKIE)?.value));
  jar.set(PREFS_COOKIE, JSON.stringify(next), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });
  revalidatePath('/inicio');
}

/** Saves section order and hidden sections from the Customize Home screen. */
export async function saveHomePrefs(order: string[], hidden: string[]) {
  const validIds = new Set<string>(HOME_SECTIONS.map((s) => s.id));
  await updatePrefsCookie((prefs) => ({
    ...prefs,
    ordem: order.filter((id) => validIds.has(id)),
    ocultos: hidden.filter((id) => validIds.has(id)),
  }));
  redirect('/inicio');
}


/** Restores all dismissed alerts on the Home screen. */
export async function restoreDismissedAlerts() {
  await updatePrefsCookie((prefs) => ({ ...prefs, fechados: [] }));
}


/** Dismisses a specific alert key on the Home screen. */
export async function dismissAlert(key: string) {
  if (!key || key.length > 120) return;
  await updatePrefsCookie((prefs) => ({
    ...prefs,
    fechados: [...prefs.fechados.filter((existing) => existing !== key), key].slice(-80),
  }));
}

