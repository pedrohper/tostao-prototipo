import Link from 'next/link';
import type { FinancialPlanResponse, ForecastResponse, ThisMonthForecast } from '@tostao/contracts';
import { DailySpendingBase } from '@/components/base-dia-a-dia';
import { Mascot } from '@/components/mascote';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { PageVisitTracker } from '@/components/visita';
import { api } from '@/lib/api';
import { money, monthName, resolveBackHref } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n';
import { getI18n } from '@/lib/i18n-server';

const short = (m: string, locale: Locale) => monthName(m, locale).slice(0, 3);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default async function PrevisaoPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const [{ voltar }, f, { plan }, { locale, t }] = await Promise.all([
    searchParams,
    api<ForecastResponse>('/forecast').catch((): ForecastResponse => ({
      hasPlan: false,
      months: [],
      goal: null,
      thisMonth: null,
    })),
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
    getI18n(),
  ]);
  const p = t.pages.previsao;
  const backHref = resolveBackHref(voltar, '/carteira?aba=planejar');
  const selfHref = voltar ? `/previsao?voltar=${encodeURIComponent(backHref)}` : '/previsao';

  if (!f.hasPlan || !f.months.length) {
    return (
      <PageFrame size="analytics">
        <PageVisitTracker kind="visita:previsao" />
        <BackLink href={backHref} label={t.common.back} />
        <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.title}</h1>
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-linha bg-cartao p-6 text-center">
          <Mascot pose="pensando" size={140} alt="Tostão" />
          <p className="text-[15px] leading-[22px]">{p.emptyBody}</p>
          <Link
            href={`/renda?voltar=${encodeURIComponent(selfHref)}`}
            className="flex h-[50px] items-center rounded-full bg-tinta px-6 text-[15px] font-semibold text-papel no-underline"
          >
            {p.tellIncomeCta}
          </Link>
        </div>
      </PageFrame>
    );
  }

  const [first] = f.months;
  const worst = f.months.reduce((a, b) => (b.leftInCents < a.leftInCents ? b : a));
  const max = Math.max(...f.months.map((m) => Math.abs(m.leftInCents)), 1);
  const aperta = worst.leftInCents < 0;
  const sal = plan?.salary;
  const salaryNote = sal ? (sal.advance ? p.advanceAndRest(sal.advance.day, sal.payday) : p.salaryDay(sal.payday)) : '';
  const firstMonthName = monthName(first.month, locale);
  const worstMonthName = monthName(worst.month, locale);

  return (
    <PageFrame size="analytics">
      <PageVisitTracker kind="visita:previsao" />
      <BackLink href={backHref} label={t.common.back} />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">{p.title}</h1>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          {f.thisMonth && <EsteMes t={f.thisMonth} labels={p} locale={locale} />}

          <div
            className={`flex items-center gap-1.5 rounded-2xl py-3 pr-3.5 pl-1.5 text-tinta ${aperta ? 'bg-rosa' : 'bg-menta-clara'}`}
          >
            <Mascot pose={aperta ? 'preocupado' : 'comemorando'} size={76} alt="Tostão" />
            <p className="text-[15px] leading-[21px]">
              {!aperta
                ? p.allGreen(firstMonthName, money(first.leftInCents))
                : worst === first
                  ? p.worstIsFirst(cap(firstMonthName), money(-worst.leftInCents))
                  : p.firstVsWorst(
                      cap(firstMonthName),
                      first.leftInCents >= 0,
                      worstMonthName,
                      money(-worst.leftInCents),
                    )}
            </p>
          </div>

          <div
            className="flex gap-3 rounded-2xl border border-linha bg-cartao p-3.5"
            role="img"
            aria-label={f.months
              .map((m) => p.barAriaItem(monthName(m.month, locale), m.leftInCents >= 0, money(Math.abs(m.leftInCents))))
              .join('; ')}
          >
            {f.months.map((m) => {
              const neg = m.leftInCents < 0;
              const h = Math.max(6, Math.round((Math.abs(m.leftInCents) / max) * 52));
              return (
                <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span
                    className={`text-[13px] font-bold tabular-nums ${neg ? 'text-vermelho-texto' : 'text-verde-texto'}`}
                  >
                    {neg ? '− ' : '+ '}
                    {money(Math.abs(m.leftInCents))}
                  </span>
                  <div className="flex h-[110px] w-full flex-col">
                    <div className="flex h-[55px] items-end">
                      {!neg && <div className="bar-up w-full rounded-[10px] bg-menta" style={{ height: h }} />}
                    </div>
                    <div className="h-px w-full bg-linha" />
                    <div className="flex h-[55px] items-start">
                      {neg && (
                        <div className="bar-down w-full rounded-[10px] bg-vermelho-texto" style={{ height: h }} />
                      )}
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold capitalize">{short(m.month, locale)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2">
            <Eyebrow>{p.pencilTitle(cap(firstMonthName))}</Eyebrow>
            <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
              <Row label={`${p.incomeLabel}${salaryNote}`} value={`+ ${money(first.incomeInCents)}`} />
              <Row label={p.fixedLabel} value={`− ${money(first.fixedInCents)}`} />
              <Row label={p.subsLabel} value={`− ${money(first.subscriptionsInCents)}`} />
              <Row label={p.installmentsLabel} value={`− ${money(first.installmentsInCents)}`} />
              <Row label={p.dailyLabel} value={`− ${money(first.dailyInCents)}`} />
              <div className="flex min-h-12 items-center justify-between gap-3">
                <span className="text-[15px] font-bold">{first.leftInCents >= 0 ? p.shouldLeft : p.shouldShort}</span>
                <span
                  className={`shrink-0 font-display text-[22px] font-extrabold tabular-nums ${first.leftInCents >= 0 ? 'text-verde-texto' : 'text-vermelho-texto'}`}
                >
                  {money(Math.abs(first.leftInCents))}
                </span>
              </div>
            </div>
          </section>

          {f.base && (
            <DailySpendingBase
              base={f.base}
              dailyInCents={first.dailyInCents}
              locale={locale}
              t={t.pages.calculators.dailyBase}
            />
          )}

          {first.benefitsInCents > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-amarelo-claro px-3.5 py-3 text-sm text-tinta">
              <span>
                {p.vrVaLabel} <span className="text-tinta-suave">{p.vrVaNote}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{money(first.benefitsInCents)}</span>
            </div>
          )}

          {f.goal && !f.goal.reached && f.goal.monthlyNeededInCents !== null && (
            <Link
              href={`/meta?voltar=${encodeURIComponent(selfHref)}`}
              className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-sm text-tinta no-underline ${f.goal.fits === false ? 'bg-rosa' : 'bg-menta-clara'}`}
            >
              <span>{p.forGoal(f.goal.label ?? '')}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {p.savePerMonth(money(f.goal.monthlyNeededInCents))}
              </span>
            </Link>
          )}

          <p className="text-xs leading-[18px] text-tinta-suave">
            {p.estimateNote}{' '}
            <Link href={`/renda?voltar=${encodeURIComponent(selfHref)}`} className="font-semibold text-laranja-texto">
              {p.adjustCta}
            </Link>
            .
          </p>

          <Link
            href="/tostao"
            className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta text-[15px] font-semibold text-tinta no-underline"
          >
            {p.askTostaoCta}
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-linha py-1.5 text-sm">
      <span>{label}</span>
      <span className="shrink-0 font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** O mês que está rolando, linha por linha: de onde sai a sobra. */
function EsteMes({
  t,
  labels,
  locale,
}: {
  t: ThisMonthForecast;
  labels: Dictionary['pages']['previsao'];
  locale: Locale;
}) {
  const pace = t.dailyPaceInCents ? money(t.dailyPaceInCents) : null;
  const rows: [string, number][] = [
    [labels.thisMonthIncome, t.incomeInCents],
    [labels.thisMonthSpent, -t.spentInCents],
    [labels.thisMonthFixedLeft, -t.fixedLeftInCents],
    [labels.thisMonthSubsLeft, -t.subscriptionsLeftInCents],
    [labels.thisMonthDaily(t.daysLeft, pace), -t.dailyLeftInCents],
  ];
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-linha bg-cartao p-3.5">
      <Eyebrow>{labels.untilEndOfMonth(monthName(t.month, locale))}</Eyebrow>
      <div className="flex flex-col text-[14px]">
        {rows
          .filter(([, v], i) => i < 2 || v !== 0)
          .map(([l, v]) => (
            <div key={l} className="flex justify-between gap-3 border-b border-linha py-1.5">
              <span className="text-tinta-suave">{l}</span>
              <span className="shrink-0 tabular-nums">
                {v < 0 ? '− ' : '+ '}
                {money(Math.abs(v))}
              </span>
            </div>
          ))}
        <div className="flex justify-between gap-3 pt-2 text-[15px] font-bold">
          <span>{t.leftInCents >= 0 ? labels.shouldLeft : labels.shouldShort}</span>
          <span className={`shrink-0 tabular-nums ${t.leftInCents >= 0 ? 'text-verde-texto' : 'text-vermelho-texto'}`}>
            {money(Math.abs(t.leftInCents))}
          </span>
        </div>
      </div>
    </section>
  );
}
