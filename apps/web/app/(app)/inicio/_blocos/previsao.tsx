// Blocos que saem da previsão (a consulta mais pesada da Home): quanto sobra no mês e as metas.
import Link from 'next/link';
import type { ForecastResponse } from '@tostao/contracts';
import { MonthLeftoverCard } from '@/components/engajamento';
import { Icon } from '@/components/icone';
import { Mascot } from '@/components/mascote';
import { money, monthName } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';
import { getForecast } from './dados';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const chevron = (
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
);

export const goalsOf = (forecast: ForecastResponse | null) =>
  forecast?.goals && forecast.goals.length > 0 ? forecast.goals : forecast?.goal ? [forecast.goal] : [];

export async function LeftoverSection() {
  const [{ locale, t }, forecast] = await Promise.all([getI18n(), getForecast()]);
  if (!forecast) return null;
  if (forecast.thisMonth) return <MonthLeftoverCard forecast={forecast} locale={locale} />;
  const [nextMonth, monthAfter] = forecast.months;
  if (!forecast.hasPlan || !nextMonth) {
    return (
      <Link
        href="/renda?voltar=/inicio"
        className="flex items-center gap-2 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5 text-tinta no-underline"
      >
        <Mascot pose="pensando" size={64} alt="Tostão" />
        <p className="grow text-body leading-[21px]">
          <b>{t.home.tellIncomePromptTitle}</b> {t.home.tellIncomePromptBody}
        </p>
        {chevron}
      </Link>
    );
  }
  const formatMonth = (m: string) => capitalize(monthName(m, locale));
  return (
    <Link
      href="/previsao?voltar=/inicio"
      className="flex items-center gap-3 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline"
    >
      <div className="flex grow flex-col gap-0.5">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          {t.home.upcomingMonthsLabel}
        </span>
        <span className="text-body leading-[21px]">
          {formatMonth(nextMonth.month)}:{' '}
          {nextMonth.leftInCents >= 0 ? (
            <b>{t.home.monthLeftover(money(nextMonth.leftInCents))}.</b>
          ) : (
            <b>{t.home.monthShortfall(money(-nextMonth.leftInCents))}.</b>
          )}
          {monthAfter && monthAfter.leftInCents < Math.min(0, nextMonth.leftInCents)
            ? t.home.monthTighter(formatMonth(monthAfter.month))
            : ''}
        </span>
      </div>
      {chevron}
    </Link>
  );
}

function NoGoalLink({ t, className = '' }: { t: Dictionary; className?: string }) {
  return (
    <Link
      href="/meta?voltar=/inicio"
      className={`flex items-center gap-3 rounded-2xl border border-dashed border-linha p-3.5 text-body text-tinta no-underline ${className}`}
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-menta-clara text-tinta"
      >
        <Icon src="meta/outro" size={26} />
      </span>
      <span className="grow">
        <b>{t.home.noGoalTitle}</b> {t.home.noGoalBody}
      </span>
    </Link>
  );
}

/** `rail` = coluna da direita no computador: se a previsão falhar, ainda oferece o caminho pra meta. */
export async function GoalsSection({ rail = false }: { rail?: boolean }) {
  const [{ locale, t }, forecast] = await Promise.all([getI18n(), getForecast()]);
  if (!forecast) return rail ? <NoGoalLink t={t} className="bg-cartao" /> : null;
  const goals = goalsOf(forecast);
  if (goals.length === 0) return <NoGoalLink t={t} />;
  const newGoalLabel = locale === 'en' ? '+ New goal' : locale === 'es' ? '+ Nueva meta' : '+ Nova meta';
  return (
    <div className="flex flex-col gap-2.5">
      {goals.map((goal) => {
        const pct = goal.amountInCents ? Math.min(100, Math.round((goal.savedInCents / goal.amountInCents) * 100)) : 0;
        const href = goal.id ? `/meta?id=${encodeURIComponent(goal.id)}&voltar=/inicio` : '/meta?voltar=/inicio';
        return (
          <Link
            key={goal.id ?? goal.label}
            href={href}
            className="flex flex-col gap-2 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline transition-colors hover:bg-papel-2/50"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
                {t.home.goalLabel(goal.label)}
              </span>
              <span className="shrink-0 text-small font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-papel-2">
              <div className="bar-fill h-full rounded-full bg-menta" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-small text-tinta-suave">
              {goal.reached ? (
                <span className="inline-flex items-center gap-1">
                  <Icon src="ui/meta-batida" size={18} />
                  {t.home.goalReached}
                </span>
              ) : (
                t.home.goalProgress(
                  money(goal.savedInCents),
                  goal.amountInCents ? money(goal.amountInCents) : null,
                  goal.monthlyNeededInCents !== null ? money(goal.monthlyNeededInCents) : null,
                )
              )}
            </span>
          </Link>
        );
      })}
      {goals.length < 10 && (
        <Link
          href="/meta?novo=1&voltar=/inicio"
          className="self-end text-xs font-semibold text-laranja-texto no-underline hover:underline"
        >
          {newGoalLabel}
        </Link>
      )}
    </div>
  );
}
