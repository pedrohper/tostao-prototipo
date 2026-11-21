'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { I18N_ENABLED } from './i18n-flag';
import { LOCALE_COOKIE, normalizeLocale, type Locale } from './i18n';

export async function setLocaleAction(nextLocale: Locale) {
  if (!I18N_ENABLED) return; // lançamento só em PT-BR: ninguém troca de idioma (nem chamando a action na mão)
  const locale = normalizeLocale(nextLocale);
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
  });
  revalidatePath('/', 'layout');
}
