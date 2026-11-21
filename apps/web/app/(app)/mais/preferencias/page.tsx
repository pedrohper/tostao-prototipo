import { cookies } from 'next/headers';
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SoundToggleCard } from '@/components/sons';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { BackLink, PageFrame } from '@/components/ui';
import { resolveBackHref } from '@/lib/format';
import { I18N_ENABLED } from '@/lib/i18n-flag';
import { getI18n } from '@/lib/i18n-server';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';

export default async function MaisPreferenciasPage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const [sp, cookieStore, { locale, t }] = await Promise.all([
    searchParams ?? Promise.resolve<{ voltar?: string }>({}),
    cookies(),
    getI18n(),
  ]);

  const initialTheme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const backHref = resolveBackHref(sp.voltar, '/mais');
  const title = locale === 'en' ? 'Preferences' : locale === 'es' ? 'Preferencias' : 'Preferências';

  return (
    <PageFrame size="focused">
      <div className="flex items-center gap-1">
        <BackLink href={backHref} label={t.common.back} />
        <h1 className="truncate font-display text-[24px] leading-[30px] font-extrabold text-tinta">{title}</h1>
      </div>

      <div className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-[18px] py-1">
        <ThemeSwitcher initialTheme={initialTheme} locale={locale} embedded />
        <SoundToggleCard locale={locale} embedded />
        {I18N_ENABLED && <LanguageSwitcher locale={locale} embedded />}
      </div>

      <Link
        href={`/inicio/personalizar?voltar=${encodeURIComponent('/mais/preferencias')}`}
        className="flex min-h-[64px] items-center justify-between gap-3 rounded-[22px] border border-linha bg-cartao px-[18px] py-3.5 text-tinta no-underline transition-colors hover:bg-papel-2"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-tinta">{t.home.customizeHome}</span>
          <span className="text-[13px] leading-[19px] text-tinta-suave">{t.pages.personalizar.subtitle}</span>
        </div>
        <span className="shrink-0 text-tinta-suave" aria-hidden="true">
          ›
        </span>
      </Link>
    </PageFrame>
  );
}
