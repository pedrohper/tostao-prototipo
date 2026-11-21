import { SupportBanner } from '@/components/support-banner';
import Link from 'next/link';
import { BackLink, PageFrame } from '@/components/ui';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';

export default async function MaisSobrePage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const [sp, { locale, t }] = await Promise.all([searchParams ?? Promise.resolve<{ voltar?: string }>({}), getI18n()]);

  const backHref = resolveBackHref(sp.voltar, '/mais');
  const title = locale === 'en' ? 'About & Legal' : locale === 'es' ? 'Acerca y Legal' : 'Sobre & Legal';

  return (
    <PageFrame size="focused">
      <div className="flex items-center gap-1">
        <BackLink href={backHref} label={t.common.back} />
        <h1 className="truncate font-display text-[24px] leading-[30px] font-extrabold text-tinta">{title}</h1>
      </div>

      <div className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-[18px] py-1">
        <Link
          href="/termos"
          className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-tinta no-underline transition-opacity hover:opacity-80"
        >
          <span>{t.legal.termsLink}</span>
          <span className="shrink-0 text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>
        <Link
          href="/privacidade"
          className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-tinta no-underline transition-opacity hover:opacity-80"
        >
          <span>{t.legal.privacyLink}</span>
          <span className="shrink-0 text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>
      </div>

      <SupportBanner text={t.profile.supportBanner} />
    </PageFrame>
  );
}
