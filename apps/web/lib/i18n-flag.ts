/**
 * Interruptor dos idiomas. O lançamento comercial é só em PT-BR (decisão fechada em docs/producao/00-INDICE.md):
 * sem `NEXT_PUBLIC_ENABLE_I18N=true` o seletor EN/ES some, o cookie de idioma é ignorado e `en`/`es` nem entram no
 * bundle do cliente. O Next troca `NEXT_PUBLIC_*` por valor literal na hora do build.
 *
 * Reativar no futuro: ligar a flag e migrar os Client Components que hoje chamam `getDictionary(locale)` (que só
 * conhece PT-BR no navegador) para receber o dicionário por um provider vindo de `getI18n()` (lib/i18n-server.ts).
 */
export const I18N_ENABLED = process.env.NEXT_PUBLIC_ENABLE_I18N === 'true';
