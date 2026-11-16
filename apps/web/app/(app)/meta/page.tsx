import Link from 'next/link';
import type { FinancialPlanResponse, ForecastResponse } from '@tostao/contracts';
import { Confetti } from '@/components/confete';
import { Icon } from '@/components/icone';
import { Mascot } from '@/components/mascote';
import { BackLink, PageFrame } from '@/components/ui';
import { api } from '@/lib/api';
import { money, monthName, resolveBackHref } from '@/lib/format';
import type { Locale } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { deleteGoal } from './actions';
import { DepositForm, GoalForm } from './forms';

const prazo = (m: string, locale: Locale) => `${monthName(m, locale).slice(0, 3)}/${m.slice(2, 4)}`;

export default async function MetaPage({ searchParams }: { searchParams: Promise<{ editar?: string; voltar?: string }> }) {
  const [{ editar, voltar }, f, { plan }, { locale, t }] = await Promise.all([
    searchParams,
    api<ForecastResponse>('/forecast').catch((): ForecastResponse => ({ hasPlan: false, months: [], goal: null, thisMonth: null })),
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
    getI18n(),
  ]);
  const p = t.pages.meta;
  const g = f.goal;
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');
  const selfHref = voltar ? `/meta?voltar=${encodeURIComponent(backHref)}` : '/meta';

  if (!g || editar) {
    return (
      <PageFrame size="analytics">
        <BackLink href={g ? selfHref : backHref} label={t.common.back} />
        <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{g ? p.editTitle : p.newTitle}</h1>
        <div className="flex max-w-[560px] flex-col gap-4">
          {!g && (
            <div className="flex items-center gap-1.5 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5 text-tinta">
              <Mascot pose="professor" size={72} alt="" />
              <p className="text-[15px] leading-[21px]">{p.emptyTip}</p>
            </div>
          )}
          <GoalForm goal={g} kind={plan?.goal?.kind} t={p.form} />
          {g && (
            <form action={deleteGoal}>
              <button type="submit" className="w-full py-2 text-sm font-semibold text-vermelho-texto underline">
                {p.deleteGoal}
              </button>
            </form>
          )}
        </div>
      </PageFrame>
    );
  }

  const pct = g.amountInCents ? Math.min(100, Math.round((g.savedInCents / g.amountInCents) * 100)) : 0;
  const falta = g.amountInCents ? Math.max(0, g.amountInCents - g.savedInCents) : 0;

  return (
    <PageFrame size="analytics">
      <BackLink href={backHref} label={t.common.back} />
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{g.label}</h1>
        <Link href={voltar ? `/meta?editar=1&voltar=${encodeURIComponent(backHref)}` : '/meta?editar=1'} className="pb-1 text-[13px] font-semibold text-laranja-texto">
          {t.common.edit}
        </Link>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[28px] font-extrabold tabular-nums">{money(g.savedInCents)}</span>
              {g.amountInCents && <span className="text-sm text-tinta-suave tabular-nums">{p.ofTarget(money(g.amountInCents))}</span>}
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-papel-2"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={p.progressAria(pct)}
            >
              <div className="bar-fill h-full rounded-full bg-menta" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-tinta-suave">
              {pct}%{g.deadline ? p.deadlinePrefix(prazo(g.deadline, locale)) : ''}
            </span>
          </div>

          {g.reached ? (
            <div className="flex items-center gap-1.5 rounded-2xl bg-menta-clara py-3 pr-3.5 pl-1.5 text-tinta">
              <Confetti />
              <Mascot pose="comemorando" size={76} alt="Tostão" />
              <p className="text-[15px] leading-[21px]">
                <b>{p.reachedBold}</b> {p.reachedBody(money(g.savedInCents))}
              </p>
            </div>
          ) : (
            g.monthlyNeededInCents !== null && (
              <div className={`flex items-center gap-1.5 rounded-2xl py-3 pr-3.5 pl-1.5 text-tinta ${g.fits === false ? 'bg-rosa' : 'bg-amarelo-claro'}`}>
                <Mascot pose={g.fits === false ? 'preocupado' : 'professor'} size={72} alt="" />
                <p className="text-[15px] leading-[21px]">
                  {p.leftSummary(money(falta), money(g.monthlyNeededInCents), monthName(g.deadline!, locale))}
                  {g.fits === true && p.fitsTrue}
                  {g.fits === false && p.fitsFalse}
                  {g.fits === null && (
                    <>
                      {' '}
                      <Link href={`/renda?voltar=${encodeURIComponent(selfHref)}`} className="font-semibold text-laranja-texto">
                        {p.fitsNullCta}
                      </Link>
                      {p.fitsNullAfter}
                    </>
                  )}
                </p>
              </div>
            )
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <DepositForm t={p.form} />
          <Link
            href={`/investir?de=meta&voltar=${encodeURIComponent(selfHref)}${falta ? `&centavos=${Math.min(falta, g.monthlyNeededInCents ?? falta)}` : ''}`}
            className="flex items-center gap-3 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline"
          >
            <Icon src="meta/reserva" size={40} />
            <span className="flex min-w-0 grow flex-col">
              <span className="text-[15px] font-bold">{p.whereToKeepTitle}</span>
              <span className="text-xs text-tinta-suave">{p.whereToKeepSub}</span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="shrink-0 text-tinta-suave"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
          <p className="text-xs leading-[18px] text-tinta-suave">{p.disclaimer}</p>
        </div>
      </div>
    </PageFrame>
  );
}
