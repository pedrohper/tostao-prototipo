import type { ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { ImportForm } from './import-form';

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; voltar?: string }>;
}) {
  const [{ conta, voltar }, me, { locale, t }] = await Promise.all([
    searchParams,
    api<ProfileResponse>('/me').catch(() => null),
    getI18n(),
  ]);
  const p = t.pages.importar;
  const contas = (me?.connections ?? [])
    .filter((c) => c.isImport)
    .map((c) => c.institution ?? '')
    .filter(Boolean);
  const backHref = resolveBackHref(voltar, '/mais');

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-center gap-3">
        <Mascot pose="conectando" size={72} alt={p.mascotAlt} />
        <div>
          <h1 className="font-display text-[28px] leading-tight font-extrabold">{p.title}</h1>
          <p className="text-[15px] text-tinta-suave">{p.subtitle}</p>
        </div>
      </div>
      <ImportForm conta={conta} contas={contas} locale={locale} />
      <div className="flex flex-col rounded-2xl bg-papel-2 px-3.5 py-3 text-[13px] leading-[19px]">
        <h2 className="text-[14px] font-bold">{p.whereToDownload}</h2>
        {p.banks.map((b) => (
          <details key={b.name} className="border-b border-linha last-of-type:border-0">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">
              {b.name}
              <span aria-hidden className="text-tinta-suave">
                +
              </span>
            </summary>
            <p className="pb-1 text-tinta-suave">{b.steps}</p>
          </details>
        ))}
        <p className="pt-2 text-tinta-suave">{p.footerNote}</p>
      </div>
    </PageFrame>
  );
}
