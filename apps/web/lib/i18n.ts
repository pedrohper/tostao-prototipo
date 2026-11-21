// Parte de i18n que os Client Components alcançam. Só importa o dicionário PT-BR: `en` e `es` (~157 KB) ficam fora
// do bundle do navegador. Os outros idiomas só existem em lib/i18n-server.ts (servidor), atrás da flag I18N_ENABLED.
import { ptBR } from './i18n-locales/pt-br';
import { I18N_ENABLED } from './i18n-flag';
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Dictionary, type Locale } from './i18n-locales/types';

export { LOCALE_COOKIE, SUPPORTED_LOCALES };
export type { Dictionary, Locale };

export function normalizeLocale(raw?: string | null): Locale {
  if (!I18N_ENABLED) return 'pt-BR'; // lançamento só em PT-BR: o cookie de idioma é ignorado
  if (raw === 'en' || raw === 'es' || raw === 'pt-BR') return raw;
  return 'pt-BR';
}

/** Dicionário no navegador (e em qualquer componente que não seja página): PT-BR. */
export function getDictionary(_locale?: Locale | string | null): Dictionary {
  return ptBR;
}
