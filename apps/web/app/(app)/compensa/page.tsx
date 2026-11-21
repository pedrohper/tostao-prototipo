import { pct, TAXAS_REFERENCIA, type TaxasResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { InstallmentCalculator } from '@/components/juros';

export default async function CompensaPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, taxas, { locale, t }] = await Promise.all([
    searchParams,
    api<TaxasResponse>('/rates').catch(() => TAXAS_REFERENCIA),
    getI18n(),
  ]);
  const p = t.pages.compensa;
  const backHref = resolveBackHref(voltar, '/aprender');

  return (
    <PageFrame size="analytics">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-8">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.title}</h1>
          <div className="flex items-center gap-1.5 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5">
            <Mascot pose="investigando" size={72} alt="" />
            <p className="text-[15px] leading-[21px]">{p.badgeDesc(pct(taxas.cdi))}</p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-linha bg-cartao p-4">
            <Eyebrow>{p.ratesTitle}</Eyebrow>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-tinta-suave">{p.cdiRef}</span>
              <span className="font-semibold tabular-nums">{p.perYear(pct(taxas.cdi))}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-tinta-suave">{p.selicRef}</span>
              <span className="font-semibold tabular-nums">{p.perYear(pct(taxas.selic))}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-tinta-suave">{p.inflation12m}</span>
              <span className="font-semibold tabular-nums">{pct(taxas.ipca12m)}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <InstallmentCalculator taxas={taxas} locale={locale} />
        </div>
      </div>
    </PageFrame>
  );
}
