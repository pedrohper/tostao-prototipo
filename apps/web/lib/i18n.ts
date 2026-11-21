import { en } from './i18n-locales/en';
import { es } from './i18n-locales/es';
import { ptBR } from './i18n-locales/pt-br';
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Dictionary, type Locale } from './i18n-locales/types';

export { LOCALE_COOKIE, SUPPORTED_LOCALES };
export type { Dictionary, Locale };

export function normalizeLocale(raw?: string | null): Locale {
  if (raw === 'en' || raw === 'es' || raw === 'pt-BR') return raw;
  return 'pt-BR';
}

export function getDictionary(locale?: Locale | string | null): Dictionary {
  const norm = normalizeLocale(locale);
  if (norm === 'en') return en;
  if (norm === 'es') return es;
  return ptBR;
}
