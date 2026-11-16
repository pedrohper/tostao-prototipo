import { cookies } from 'next/headers';
import { LOCALE_COOKIE, getDictionary, normalizeLocale, type Locale } from './i18n';

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return normalizeLocale(jar.get(LOCALE_COOKIE)?.value);
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
