import { TAXAS_REFERENCIA, type FinancialPlanResponse, type ForecastResponse, type TaxasResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { OndeInvestir } from '@/components/juros';

export default async function InvestirPage({ searchParams }: { searchParams: Promise<{ centavos?: string; de?: string }> }) {
  const { centavos, de } = await searchParams;
  const [taxas, forecast, { plan }] = await Promise.all([
    api<TaxasResponse>('/rates').catch(() => TAXAS_REFERENCIA),
    api<ForecastResponse>('/forecast').catch(() => null),
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
  ]);
  // Quanto sai num mês normal: contas fixas + assinaturas + parcelas + dia a dia da previsão
  const m = forecast?.months[0];
  const gasto = m ? m.fixedInCents + m.subscriptionsInCents + m.installmentsInCents + m.dailyInCents : 0;
  const reserva = plan?.goal?.kind === 'reserva' ? forecast?.goal?.savedInCents ?? 0 : null;
  const inicial = Number(centavos) || null;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={de === 'meta' ? '/meta' : '/aprender'} />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Onde investir</h1>
      <div className="flex items-center gap-1.5 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5">
        <Mascote pose="professor" size={72} alt="" />
        <p className="text-[15px] leading-[21px]">Investir tem ordem: primeiro tirar o pé da dívida, depois o muro da reserva, aí sim pensar em render mais. Me diz quanto você tem que eu te mostro o caminho.</p>
      </div>
      <OndeInvestir taxas={taxas} gastoMensalInCents={gasto > 0 ? gasto : null} reservaGuardadaInCents={reserva} valorInicialInCents={inicial && inicial > 0 ? inicial : 100000} />
    </div>
  );
}
