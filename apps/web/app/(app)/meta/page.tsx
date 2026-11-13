import Link from 'next/link';
import type { ForecastResponse, FinancialPlanResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, monthName } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import { Confete } from '@/components/confete';
import { Icone } from '@/components/icone';
import { DepositForm, GoalForm } from './forms';
import { deleteGoal } from './actions';

const prazo = (m: string) => `${monthName(m).slice(0, 3)}/${m.slice(2, 4)}`;

export default async function MetaPage({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const [f, { plan }] = await Promise.all([
    api<ForecastResponse>('/forecast').catch((): ForecastResponse => ({ hasPlan: false, months: [], goal: null, thisMonth: null })),
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
  ]);
  const g = f.goal;

  if (!g || editar) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={g ? '/meta' : '/inicio'} />
        <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{g ? 'Editar meta' : 'Minha meta'}</h1>
        {!g && (
          <div className="flex items-center gap-1.5 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5">
            <Mascote pose="professor" size={72} alt="" />
            <p className="text-[15px] leading-[21px]">Uma meta só, com valor e data. Eu te digo quanto guardar por mês e se cabe no que sobra.</p>
          </div>
        )}
        <GoalForm goal={g} kind={plan?.goal?.kind} />
        {g && (
          <form action={deleteGoal}>
            <button type="submit" className="w-full py-2 text-sm font-semibold text-vermelho-texto underline">Apagar meta</button>
          </form>
        )}
      </div>
    );
  }

  const pct = g.amountInCents ? Math.min(100, Math.round((g.savedInCents / g.amountInCents) * 100)) : 0;
  const falta = g.amountInCents ? Math.max(0, g.amountInCents - g.savedInCents) : 0;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/inicio" />
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{g.label}</h1>
        <Link href="/meta?editar=1" className="pb-1 text-[13px] font-semibold text-laranja-texto">Editar</Link>
      </div>

      <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[28px] font-extrabold tabular-nums">{money(g.savedInCents)}</span>
          {g.amountInCents && <span className="text-sm text-tinta-suave tabular-nums">de {money(g.amountInCents)}</span>}
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-papel-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% da meta`}>
          <div className="bar-fill h-full rounded-full bg-menta" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[13px] font-semibold text-tinta-suave">{pct}%{g.deadline ? ` · prazo ${prazo(g.deadline)}` : ''}</span>
      </div>

      {g.reached ? (
        <div className="flex items-center gap-1.5 rounded-2xl bg-menta-clara py-3 pr-3.5 pl-1.5">
          <Confete />
          <Mascote pose="comemorando" size={76} alt="Tostão comemorando" />
          <p className="text-[15px] leading-[21px]"><b>Meta batida!</b> Você juntou {money(g.savedInCents)}. Bora pensar na próxima?</p>
        </div>
      ) : g.monthlyNeededInCents !== null && (
        <div className={`flex items-center gap-1.5 rounded-2xl py-3 pr-3.5 pl-1.5 ${g.fits === false ? 'bg-rosa' : 'bg-amarelo-claro'}`}>
          <Mascote pose={g.fits === false ? 'preocupado' : 'professor'} size={72} alt="" />
          <p className="text-[15px] leading-[21px]">
            Faltam {money(falta)}. Guardando <b>{money(g.monthlyNeededInCents)} por mês</b> você chega em {monthName(g.deadline!)}.
            {g.fits === true && ' Cabe no que deve sobrar.'}
            {g.fits === false && ' Pela previsão não sobra isso: estica o prazo ou corta um gasto.'}
            {g.fits === null && <> <Link href="/renda" className="font-semibold text-laranja-texto">Conta sua renda</Link> que eu digo se cabe.</>}
          </p>
        </div>
      )}

      <DepositForm />
      <Link href={`/investir?de=meta${falta ? `&centavos=${Math.min(falta, g.monthlyNeededInCents ?? falta)}` : ''}`} className="flex items-center gap-3 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline">
        <Icone src="meta/reserva" size={40} />
        <span className="flex grow flex-col">
          <span className="text-[15px] font-bold">Onde guardar esse dinheiro?</span>
          <span className="text-xs text-tinta-suave">Reserva, Tesouro, CDB: o caminho certo pra cada objetivo</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-tinta-suave"><path d="M9 18l6-6-6-6" /></svg>
      </Link>
      <p className="text-xs leading-[18px] text-tinta-suave">O Tostão não mexe no seu dinheiro: você guarda onde quiser e anota aqui.</p>
    </div>
  );
}
