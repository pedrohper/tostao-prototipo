import { cookies } from 'next/headers';
import { I18N_ENABLED } from './i18n-flag';
import { LOCALE_COOKIE, getDictionary, normalizeLocale, type Dictionary, type Locale } from './i18n';

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
}

/**
 * Dicionário completo de um idioma, só no servidor. `en`/`es` entram por import dinâmico e só com a flag ligada: com
 * ela desligada (lançamento PT-BR) esses 157 KB nem são carregados.
 */
export async function loadDictionary(locale: Locale): Promise<Dictionary> {
  if (I18N_ENABLED && locale === 'en') return (await import('./i18n-locales/en')).en;
  if (I18N_ENABLED && locale === 'es') return (await import('./i18n-locales/es')).es;
  return getDictionary(locale);
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: await loadDictionary(locale) };
}
