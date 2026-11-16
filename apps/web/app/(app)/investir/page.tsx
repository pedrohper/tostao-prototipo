import {
  TAXAS_REFERENCIA,
  type FinancialPlanResponse,
  type ForecastResponse,
  type TaxasResponse,
} from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { InvestmentComparison } from '@/components/juros';

export default async function InvestirPage({
  searchParams,
}: {
  searchParams: Promise<{ centavos?: string; de?: string; voltar?: string }>;
}) {
  const { centavos, de, voltar } = await searchParams;
  const [taxas, forecast, { plan }, { locale, t }] = await Promise.all([
    api<TaxasResponse>('/rates').catch(() => TAXAS_REFERENCIA),
    api<ForecastResponse>('/forecast').catch(() => null),
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
    getI18n(),
  ]);
  const p = t.pages.investir;
  // Quanto sai num mês normal: contas fixas + assinaturas + parcelas + dia a dia da previsão
  const m = forecast?.months[0];
  const gasto = m ? m.fixedInCents + m.subscriptionsInCents + m.installmentsInCents + m.dailyInCents : 0;
  const reserva = plan?.goal?.kind === 'reserva' ? (forecast?.goal?.savedInCents ?? 0) : null;
  const inicial = Number(centavos) || null;
  const backHref = resolveBackHref(voltar, de === 'meta' ? '/meta' : '/aprender');

  return (
    <PageFrame size="analytics">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-8">
          <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.title}</h1>
          <div className="flex items-center gap-1.5 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5">
            <Mascot pose="professor" size={72} alt="" />
            <p className="text-[15px] leading-[21px]">{p.intro}</p>
          </div>
          {gasto > 0 && (
            <div className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-cartao p-4 text-sm">
              <Eyebrow>{p.refTitle}</Eyebrow>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-tinta-suave">{p.monthlySpendEst}</span>
                <span className="font-semibold tabular-nums">{money(gasto)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-tinta-suave">{p.idealReserve}</span>
                <span className="font-bold tabular-nums">{money(gasto * 6)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <InvestmentComparison
            taxas={taxas}
            gastoMensalInCents={gasto > 0 ? gasto : null}
            reservaGuardadaInCents={reserva}
            valorInicialInCents={inicial && inicial > 0 ? inicial : 100000}
            locale={locale}
            t={t.pages.calculators}
          />
        </div>
      </div>
    </PageFrame>
  );
}
