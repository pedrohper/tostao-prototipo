import { Fragment, Suspense } from 'react';
import Link from 'next/link';
import type {
  BudgetsResponse,
  ForecastResponse,
  FriendsResponse,
  MonthSummaryResponse,
  PeopleResponse,
  RemindersResponse,
  SubscriptionsResponse,
  SummaryHistoryResponse,
  TostaoInsightDTO,
  WeeklyResponse,
} from '@tostao/contracts';
import { CardNetworkBadge, BankBadge } from '@/components/banco';
import { getBankLogos } from '@/lib/api-queries';
import { BudgetBar } from '@/components/budget-bar';
import { MonthLeftoverCard, UpcomingReminders, WeeklySummaryCard } from '@/components/engajamento';
import { DismissibleCard } from '@/components/fechavel';
import { Await, SectionSkeleton, startEarly } from '@/components/suspense';
import { orFallback } from '@/lib/rethrow';
import { CatIcon, Icon } from '@/components/icone';
import { CashflowLineChart, CategoryBars } from '@/components/graficos';
import { QuickAddButton } from '@/components/quick-add-sheet';
import { DesktopSplitShell } from '@/components/lateral';
import { Mascot } from '@/components/mascote';
import { MissionCompletionToast } from '@/components/sons';
import { StreakModalButton } from '@/components/streak-modal';
import { TostaoFindingsBoard } from '@/components/tostao-auto-card';
import { ButtonLink, Card } from '@/components/ui';
import { api } from '@/lib/api';
import {
  ago,
  currentDayOfMonth,
  currentMonth,
  money,
  monthName,
  nowMs,
  shiftMonth,
  shortDate,
  todayIso,
} from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { restoreDismissedAlerts } from '@/lib/inicio-actions';
import { readHomePrefs, resolveSectionOrder, type HomeSectionId } from '@/lib/inicio-prefs';
import { modules } from '@/lib/lessons';
import { NO_PROGRESS } from '@/lib/xp';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { activationChecklist } from '@/lib/onboarding';
import { AskTostaoCard } from './ask-card';
import { changePct, stackedSegments } from '@/lib/chart-math';
import { unifyAlerts, type LocalAlertKey } from '@/lib/home-alerts';
import { DesktopBalanceRow, MobileBalanceCard, type BalanceCardProps } from './balance-card';
import { PlanejarAtalhos } from './planejar-atalhos';
import { getMe, getMissions, getProgress, getTostaoAuto } from '@/lib/api-queries';

const DESKTOP_LEFT_EXTRAS = new Set<HomeSectionId>(['sobra', 'cartoes', 'limites', 'acertos', 'vence']);

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
const stripChevron = (str: string) => str.replace(/\s*›$/, '');

function MonthChevron({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export default async function HomePage({ searchParams }: { searchParams?: Promise<{ mes?: string }> }) {
  const sp = await (searchParams ?? Promise.resolve<{ mes?: string }>({}));
  const hoje = currentMonth();
  const rawMes = sp.mes;
  const month = /^\d{4}-\d{2}$/.test(rawMes ?? '') && rawMes! <= hoje ? rawMes! : hoje;
  const [prefs, { locale, t }] = await Promise.all([readHomePrefs(), getI18n()]);
  const isSectionVisible = (id: HomeSectionId) => !prefs.ocultos.includes(id);
  const isAlertOpen = (key: string) => !prefs.fechados.includes(key);

  // Seções abaixo da dobra que só dependem do próprio endpoint: a requisição começa já, mas a página NÃO espera por ela
  // (cada uma tem seu <Suspense> mais abaixo e chega por streaming). O que o topo precisa continua no Promise.all.
  const remindersP = startEarly(api<RemindersResponse>('/reminders').catch(orFallback({ reminders: [] })));
  const weeklyP = startEarly(api<WeeklyResponse>('/weekly').catch(orFallback(null)));
  const splitsP = startEarly(api<PeopleResponse>('/people').catch(orFallback(null)));

  const [
    profile,
    summary,
    subscriptions,
    budgetsData,
    progress,
    forecast,
    missions,
    bankLogos,
    auto,
    friends,
    history,
  ] = await Promise.all([
    getMe(),
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
    api<BudgetsResponse>(`/budgets?month=${month}`).catch(() => ({ budgets: [] })),
    getProgress().catch(() => NO_PROGRESS),
    api<ForecastResponse>('/forecast').catch(() => null),
    getMissions().catch(() => null),
    getBankLogos(),
    getTostaoAuto().catch(() => null),
    api<FriendsResponse>('/friends').catch(() => null),
    // Evolução mensal (3 queries pra 6 meses). Sem ela a Home só perde o gráfico.
    api<SummaryHistoryResponse>(`/summary/history?month=${month}&months=6`).catch(() => null),
  ]);

  const overBudgetCategory = budgetsData.budgets.find((b) => b.spentInCents > b.limitInCents);
  const activeSubscriptionCount = subscriptions?.subscriptions.filter((sub) => sub.active).length ?? 0;
  const currentMonthLabel = monthName(month, locale);
  const topCategories = summary.byCategory.filter((c) => c.categoryId);
  const deliveryCategory = summary.byCategory.find((c) => c.categoryId === 'delivery');
  const bankAccounts = summary.accounts.filter((a) => a.type === 'BANK');
  const creditCards = summary.accounts.filter((a) => a.type === 'CREDIT');
  const institutionByAccountId = new Map<string, string>();
  for (const conn of profile.connections) {
    for (const acc of conn.accounts) institutionByAccountId.set(acc.id, conn.displayName);
  }

  const previousMonth = shiftMonth(month, -1);
  const shouldShowMonthlyClosing = currentDayOfMonth() <= 10;
  const brokenConnections = profile.connections.filter((c) => c.status === 'ERROR' && !c.isImport);
  const lastSyncIso = profile.connections
    .map((c) => c.lastSyncedAt)
    .filter((iso): iso is string => Boolean(iso))
    .sort()
    .at(-1);
  const isEmptyState = summary.balanceInCents === null && summary.outcomeInCents === 0 && summary.incomeInCents === 0;
  const outcomePct =
    summary.incomeInCents > 0 ? Math.round((summary.outcomeInCents / summary.incomeInCents) * 100) : null;

  const atualIdx = modules.findIndex((m) => m.lessons.some((l) => !progress.done.includes(l.id)));
  const atual = atualIdx >= 0 ? modules[atualIdx] : null;
  const proxima = atual?.lessons.find((l) => !progress.done.includes(l.id));
  const feitas = atual ? atual.lessons.filter((l) => progress.done.includes(l.id)).length : 0;

  const tipKey = `dica:${month}:${deliveryCategory && deliveryCategory.totalInCents >= 10000 ? 'delivery' : 'chat'}`;

  const uncategorizedAlertCard =
    summary.uncategorizedCount > 0 && isAlertOpen(`pendentes:${month}:${summary.uncategorizedCount}`) ? (
      <DismissibleCard id={`pendentes:${month}:${summary.uncategorizedCount}`} label={t.home.dismissAlertLabel}>
        <Link
          href="/carteira?filtro=pendentes"
          className="flex items-center gap-2 rounded-2xl bg-azul py-3 pr-10 pl-2 text-tinta no-underline"
        >
          <Mascot pose="caramelo-farejando" size={72} alt="Caramelo" />
          <p className="text-[15px] leading-[21px]">
            {locale === 'pt-BR' ? 'O Caramelo:' : 'Caramelo:'}{' '}
            <b>{t.home.uncategorizedAlert(summary.uncategorizedCount)}</b>.
          </p>
        </Link>
      </DismissibleCard>
    ) : null;

  const monthlyClosingAlert =
    shouldShowMonthlyClosing && isAlertOpen(`fechamento:${previousMonth}`) ? (
      <DismissibleCard id={`fechamento:${previousMonth}`} label={t.home.dismissAlertLabel}>
        <Link
          href="/fechamento?voltar=/inicio"
          className="flex items-center gap-2 rounded-2xl bg-menta-clara p-3 pr-10 text-tinta no-underline"
        >
          <Mascot pose="professor" size={64} alt="Tostão" />
          <p className="text-[15px] leading-[21px]">
            <b>{t.home.monthlyClosingReady(monthName(previousMonth, locale))}</b> {t.home.monthlyClosingSub}
          </p>
        </Link>
      </DismissibleCard>
    ) : null;

  const subscriptionsAlert =
    activeSubscriptionCount > 0 &&
    subscriptions &&
    isAlertOpen(`assinaturas:${activeSubscriptionCount}:${subscriptions.monthlyInCents}`) ? (
      <DismissibleCard
        id={`assinaturas:${activeSubscriptionCount}:${subscriptions.monthlyInCents}`}
        label={t.home.dismissAlertLabel}
      >
        <Link
          href="/assinaturas?voltar=/inicio"
          className="flex items-center gap-2 rounded-2xl bg-amarelo-claro p-3 pr-10 text-tinta no-underline"
        >
          <Mascot pose="investigando" size={64} alt="Tostão" />
          <p className="text-[15px] leading-[21px]">
            {t.home.activeSubscriptionsAlert(
              activeSubscriptionCount,
              money(subscriptions.monthlyInCents),
              money(subscriptions.yearlyInCents),
            )}
          </p>
        </Link>
      </DismissibleCard>
    ) : null;

  const deliveryTipCard =
    isAlertOpen(tipKey) && deliveryCategory && deliveryCategory.totalInCents >= 10000 ? (
      <DismissibleCard id={tipKey} label={t.home.dismissAlertLabel}>
        <div className="relative flex items-center gap-2 rounded-2xl bg-rosa py-3.5 pr-10 pl-2 text-tinta">
          <Link href="/aprender/m1-l2" aria-label={t.home.viewLessonCta} className="absolute inset-0 rounded-2xl" />
          <Mascot pose="preocupado" size={92} alt="Tostão" />
          <div className="flex min-w-0 flex-col gap-2.5">
            <p className="text-[15px] leading-[21px]">
              <b>{t.home.deliveryAlert(money(deliveryCategory.totalInCents))}</b>.
            </p>
            <div className="relative z-[1] flex flex-wrap gap-2">
              <Link
                href="/aprender/m1-l2"
                className="flex h-9 items-center rounded-full bg-tinta px-4 text-sm font-semibold text-papel no-underline"
              >
                {t.home.viewLessonCta}
              </Link>
              <Link
                href="/tostao"
                className="flex h-9 items-center rounded-full border-[1.5px] border-tinta px-4 text-sm font-semibold text-tinta no-underline"
              >
                {t.home.askTostao}
              </Link>
            </div>
          </div>
        </div>
      </DismissibleCard>
    ) : null;

  const overBudgetCard = overBudgetCategory && isAlertOpen(`estourou:${overBudgetCategory.categoryId}:${month}`) && (
    <DismissibleCard id={`estourou:${overBudgetCategory.categoryId}:${month}`} label={t.home.dismissAlertLabel}>
      <Link
        href="/limites?voltar=/inicio"
        className="flex items-center gap-2 rounded-2xl bg-rosa p-3 pr-10 text-tinta no-underline"
      >
        <Mascot pose="chocado" size={64} alt="Tostão" />
        <p className="text-[15px] leading-[21px]">
          <b>
            {t.home.overBudgetAlert(
              overBudgetCategory.name,
              money(overBudgetCategory.spentInCents),
              money(overBudgetCategory.limitInCents),
            )}
          </b>
        </p>
      </Link>
    </DismissibleCard>
  );

  // T4.3 · avisos unificados: no máximo 2, sem repetir o que o quadro de achados do Tostão já diz.
  const localAlertNodes: Record<LocalAlertKey, React.ReactNode> = {
    overBudget: overBudgetCard,
    uncategorized: uncategorizedAlertCard,
    deliveryTip: deliveryTipCard,
    monthlyClosing: monthlyClosingAlert,
    subscriptions: subscriptionsAlert,
  };
  const localPresent = (Object.keys(localAlertNodes) as LocalAlertKey[]).filter((k) => Boolean(localAlertNodes[k]));
  const unified = unifyAlerts<TostaoInsightDTO>({ insights: auto?.insights ?? [], local: localPresent });

  const sectionsById: Record<HomeSectionId, React.ReactNode> = {
    atalhos: <PlanejarAtalhos t={t} />,
    aula: (
      <Link
        href={proxima ? `/aprender/${proxima.id}` : '/aprender/trilha'}
        className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3.5 pr-4 text-tinta no-underline"
      >
        <Mascot pose="professor" size={84} alt="Tostão" className="shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-xs font-semibold text-tinta-suave">
            {atual
              ? t.home.learnModuleProgress(atual.number, feitas, atual.lessons.length)
              : t.home.allModulesCompleted}
          </span>
          <span className="font-display text-[18px] leading-[22px] font-extrabold">
            {proxima?.title ?? atual?.title ?? t.home.allModulesCompleted}
          </span>
          {atual && (
            <span className="flex gap-1" aria-hidden="true">
              {atual.lessons.map((lesson) => (
                <i
                  key={lesson.id}
                  className={`h-1.5 flex-1 rounded-full ${progress.done.includes(lesson.id) ? 'bg-tinta' : 'bg-cartao'}`}
                />
              ))}
            </span>
          )}
          <span className="text-[13px] font-semibold">{t.nav.continueLesson} ›</span>
        </span>
      </Link>
    ),
    sobra: (
      <>
        {forecast?.thisMonth && <MonthLeftoverCard forecast={forecast} locale={locale} />}
        {forecast &&
          !forecast.thisMonth &&
          (() => {
            const [nextMonthForecast, monthAfterForecast] = forecast.months;
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
            if (!forecast.hasPlan || !nextMonthForecast) {
              return (
                <Link
                  href="/renda?voltar=/inicio"
                  className="flex items-center gap-2 rounded-2xl bg-amarelo-claro py-3 pr-3.5 pl-1.5 text-tinta no-underline"
                >
                  <Mascot pose="pensando" size={64} alt="Tostão" />
                  <p className="grow text-[15px] leading-[21px]">
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
                  <span className="text-[15px] leading-[21px]">
                    {formatMonth(nextMonthForecast.month)}:{' '}
                    {nextMonthForecast.leftInCents >= 0 ? (
                      <b>{t.home.monthLeftover(money(nextMonthForecast.leftInCents))}.</b>
                    ) : (
                      <b>{t.home.monthShortfall(money(-nextMonthForecast.leftInCents))}.</b>
                    )}
                    {monthAfterForecast && monthAfterForecast.leftInCents < Math.min(0, nextMonthForecast.leftInCents)
                      ? t.home.monthTighter(formatMonth(monthAfterForecast.month))
                      : ''}
                  </span>
                </div>
                {chevron}
              </Link>
            );
          })()}
      </>
    ),
    vence: (
      <Suspense fallback={<SectionSkeleton height="h-20" />}>
        <Await promise={remindersP}>
          {(remindersData) => (
            <UpcomingReminders reminders={remindersData.reminders.filter((r) => isAlertOpen(r.key))} locale={locale} />
          )}
        </Await>
      </Suspense>
    ),
    avisos: (
      <>
        {unified.local.map((key) => (
          <Fragment key={key}>{localAlertNodes[key]}</Fragment>
        ))}
      </>
    ),
    evolucao:
      history && history.months.some((m) => m.incomeInCents > 0 || m.outcomeInCents > 0) ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-xl leading-[26px] font-extrabold">{t.growth.home.evolutionTitle}</h2>
            <p className="text-[13px] leading-[18px] text-tinta-suave">{t.growth.home.evolutionSub}</p>
          </div>
          <Card>
            <CashflowLineChart
              data={history.months.map((m) => ({
                month: m.month,
                inInCents: m.incomeInCents,
                outInCents: m.outcomeInCents,
              }))}
              atual={month}
              locale={locale}
              monthBasePath="/inicio"
            />
          </Card>
        </section>
      ) : null,
    'pra-onde-foi': (
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl leading-[26px] font-extrabold">{t.home.whereItWentTitle}</h2>
          <Link
            href={`/carteira?mes=${month}&filtro=saidas#lista`}
            className="text-[13px] font-semibold text-laranja-texto"
          >
            {t.home.viewAll}
          </Link>
        </div>
        {lastSyncIso && (
          <span className="-mt-2 text-xs font-medium text-tinta-suave">
            {t.home.updatedAgo(ago(lastSyncIso, nowMs(), locale))}
          </span>
        )}
        {topCategories.length === 0 && (
          <p className="text-sm text-tinta-suave">{t.home.noCategorizedExpenses(currentMonthLabel)}</p>
        )}
        <CategoryBars
          items={topCategories}
          max={5}
          locale={locale}
          otherLabel={t.common.other}
          hrefBase="/carteira"
          hrefParams={{ mes: month }}
        />
      </section>
    ),
    semana: (
      <Suspense fallback={<SectionSkeleton />}>
        <Await promise={weeklyP}>
          {(weekly) =>
            weekly && isAlertOpen(`semana:${weekly.from}`) ? (
              <DismissibleCard id={`semana:${weekly.from}`} label={t.home.dismissAlertLabel}>
                <WeeklySummaryCard w={weekly} locale={locale} />
              </DismissibleCard>
            ) : null
          }
        </Await>
      </Suspense>
    ),
    meta: (
      <>
        {forecast &&
          (() => {
            const goals =
              forecast.goals && forecast.goals.length > 0 ? forecast.goals : forecast.goal ? [forecast.goal] : [];
            if (goals.length === 0) {
              return (
                <Link
                  href="/meta?voltar=/inicio"
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-linha p-3.5 text-[15px] text-tinta no-underline"
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
            const newGoalLabel = locale === 'en' ? '+ New goal' : locale === 'es' ? '+ Nueva meta' : '+ Nova meta';
            return (
              <div className="flex flex-col gap-2.5">
                {goals.map((goal) => {
                  const pct = goal.amountInCents
                    ? Math.min(100, Math.round((goal.savedInCents / goal.amountInCents) * 100))
                    : 0;
                  const href = goal.id
                    ? `/meta?id=${encodeURIComponent(goal.id)}&voltar=/inicio`
                    : '/meta?voltar=/inicio';
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
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-papel-2">
                        <div className="bar-fill h-full rounded-full bg-menta" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[13px] text-tinta-suave">
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
          })()}
      </>
    ),
    acertos: (
      <Suspense fallback={<SectionSkeleton />}>
        <Await promise={splitsP}>
          {(splits) => (
            <>
              {splits &&
                (splits.owedToYouInCents > 0 || splits.youOweInCents > 0) &&
                (() => {
                  const owedToMe = splits.people.filter((p) => p.balanceInCents > 0);
                  const iOwe = splits.people.filter((p) => p.balanceInCents < 0);
                  return (
                    <Link
                      href="/acertos?voltar=/inicio"
                      className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline"
                    >
                      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
                        {t.home.splitsLabel}
                      </span>
                      <div className="flex items-baseline justify-between gap-3">
                        {splits.owedToYouInCents > 0 && (
                          <span className="text-[15px]">
                            {t.home.owedToYou}{' '}
                            <b className="text-verde-texto tabular-nums">{money(splits.owedToYouInCents)}</b>
                          </span>
                        )}
                        {splits.youOweInCents > 0 && (
                          <span className="text-[15px]">
                            {t.home.youOwe}{' '}
                            <b className="text-vermelho-texto tabular-nums">{money(splits.youOweInCents)}</b>
                          </span>
                        )}
                      </div>
                      <span className="truncate text-[13px] text-tinta-suave">
                        {[...owedToMe, ...iOwe]
                          .slice(0, 3)
                          .map((p) => `${p.name} ${money(Math.abs(p.balanceInCents))}`)
                          .join(' · ')}
                      </span>
                    </Link>
                  );
                })()}
            </>
          )}
        </Await>
      </Suspense>
    ),
    cartoes: (
      <>
        {creditCards.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                <h2 className="font-display text-xl leading-[26px] font-extrabold">{t.home.creditCardsTitle}</h2>
                <span className="rounded-full bg-bronze-suave px-2.5 py-0.5 text-xs font-bold text-tinta tabular-nums">
                  {money(creditCards.reduce((sum, c) => sum + Math.max(0, -c.balanceInCents), 0))}
                </span>
              </div>
              <Link href="/carteira?aba=contas" className="shrink-0 text-[13px] font-semibold text-laranja-texto">
                {t.home.viewAllCards}
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {creditCards.map((card, idx) => {
                const currentBillCents = Math.max(0, -card.balanceInCents);
                const usagePct = card.creditLimitInCents
                  ? Math.min(100, (currentBillCents / card.creditLimitInCents) * 100)
                  : null;
                return (
                  <Link
                    key={card.id}
                    href={`/carteira/conta/${card.id}`}
                    className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-4 text-tinta no-underline transition-colors hover:bg-papel-2/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-tinta">
                        <BankBadge
                          nome={card.name}
                          instituicao={institutionByAccountId.get(card.id)}
                          size={24}
                          quadrado
                          logos={bankLogos}
                        />
                        <span className="truncate">{card.name}</span>
                      </span>
                      <CardNetworkBadge brand={card.brand} last4={card.last4} className="shrink-0" />
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-display text-[21px] leading-6 font-extrabold tabular-nums">
                        {money(currentBillCents)}
                      </span>
                      <span className="text-xs font-medium text-tinta-suave">
                        {card.dueDate ? t.home.billDueOn(shortDate(card.dueDate, locale)) : t.home.currentBill}
                      </span>
                    </div>
                    {usagePct !== null && (
                      <div className="h-1.5 rounded-full bg-papel-2" title={`${Math.round(usagePct)}%`}>
                        <div
                          className={`bar-fill h-full rounded-full ${idx === 0 ? 'bg-laranja' : 'bg-tinta'}`}
                          style={{ width: `${Math.max(2, usagePct)}%` }}
                        />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </>
    ),
    limites: (
      <Link
        href="/limites?voltar=/inicio"
        className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4 text-tinta no-underline"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">{t.home.limitsTitle}</h2>
          <span className="text-[13px] font-semibold text-laranja-texto">
            {budgetsData.budgets.length ? t.home.editAction : t.home.setAction}
          </span>
        </div>
        {budgetsData.budgets.length === 0 ? (
          <p className="text-sm text-tinta-suave">{t.home.emptyLimitsHint}</p>
        ) : (
          budgetsData.budgets
            .slice(0, 3)
            .map((b) => <BudgetBar key={b.categoryId} budget={b} t={t.pages.limites.bar} />)
        )}
      </Link>
    ),
  };

  const visibleSections = resolveSectionOrder(prefs).filter(isSectionVisible);

  const isPastMonth = month < hoje;
  const rawBalanceLabel = isPastMonth
    ? t.home.balanceAtEndOfMonth(currentMonthLabel)
    : t.home.balanceInAccounts(bankAccounts.length);

  // Variação do gasto vs mês anterior. No mês corrente o gasto está pela metade: comparar com o mês cheio daria
  // "-60%" enganoso, então mostramos quanto do mês passado já foi gasto.
  const prevPoint = history?.months.at(-2);
  const spendingChangeLabel =
    prevPoint && prevPoint.outcomeInCents > 0 && summary.outcomeInCents > 0
      ? month === hoje
        ? t.growth.home.spentSoFarOfPrev(
            Math.round((summary.outcomeInCents / prevPoint.outcomeInCents) * 100),
            monthName(prevPoint.month, locale),
          )
        : t.growth.home.outcomeChange(changePct(summary.outcomeInCents, prevPoint.outcomeInCents) ?? 0)
      : null;
  // Cartão: saldo negativo = fatura em aberto.
  const openBillsInCents = creditCards.reduce((sum, c) => sum + Math.max(0, -c.balanceInCents), 0);
  const noAccounts = bankAccounts.length === 0 && creditCards.length === 0;

  const balanceProps: BalanceCardProps = {
    month,
    balanceInCents: summary.balanceInCents,
    incomeInCents: summary.incomeInCents,
    outcomeInCents: summary.outcomeInCents,
    outcomePct,
    walletLabel: t.nav.wallet,
    balanceLabel: rawBalanceLabel,
    balanceLabelDesktop: stripChevron(rawBalanceLabel),
    noConnectedBankHint: t.home.noConnectedBankHint,
    incomeLabel: t.home.incomeLabel,
    incomeLabelDesktop: t.home.incomeLabel,
    outcomeLabel: t.home.outcomeLabel,
    outcomeLabelDesktop: t.home.outcomeLabel,
    percentOfIncomeLabel: outcomePct !== null ? t.home.percentOfIncome(outcomePct) : null,
    hideBalanceAria: t.home.hideBalanceAria,
    showBalanceAria: t.home.showBalanceAria,
    accountsPreview: bankAccounts.slice(0, 3).map((a) => ({ name: a.name, balanceInCents: a.balanceInCents })),
    changeLabel: spendingChangeLabel,
    openBillsLabel: openBillsInCents > 0 ? t.growth.home.openBills(money(openBillsInCents)) : null,
    connectCta: noAccounts ? { label: t.growth.home.connectCta, href: '/conectar?voltar=/inicio' } : null,
  };

  const balanceCard = <MobileBalanceCard {...balanceProps} />;

  const brokenConnectionsAlert = brokenConnections.length > 0 && (
    <Link
      href="/conectar"
      role="alert"
      className="flex items-center gap-3 rounded-2xl bg-amarelo-claro p-3 text-tinta no-underline"
    >
      <Mascot pose="preocupado" size={56} alt="" />
      <p className="text-[15px]">{t.home.connectionBroken(brokenConnections.map((c) => c.displayName).join(', '))}</p>
    </Link>
  );

  // Home vazia (sem lançamento nem saldo): em vez de esconder tudo, mostra os primeiros passos e MANTÉM o que a
  // pessoa já preencheu (renda/previsão, meta e aula), pra o plano que ela acabou de montar aparecer na hora.
  const goalsForChecklist = forecast
    ? forecast.goals && forecast.goals.length > 0
      ? forecast.goals
      : forecast.goal
        ? [forecast.goal]
        : []
    : [];
  const firstLessonHref = proxima ? `/aprender/${proxima.id}` : '/aprender';
  const checklist = activationChecklist({
    hasConnection: profile.connections.length > 0,
    hasTransactions: !isEmptyState,
    hasGoal: goalsForChecklist.length > 0,
    lessonsDone: progress.done.length,
    firstLessonHref,
  });
  const fs = t.growth.firstSteps;
  const emptyStateCard = (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Mascot pose="dormindo" size={96} alt="Tostão" className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-[22px] leading-[26px] font-extrabold">{fs.title}</h2>
          <p className="text-[14px] leading-[20px] text-tinta-suave">{fs.subtitle}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label={fs.progress(checklist.doneCount, checklist.total)}
          aria-valuemin={0}
          aria-valuemax={checklist.total}
          aria-valuenow={checklist.doneCount}
          className="h-2 overflow-hidden rounded-full bg-papel-2"
        >
          <div
            className="h-full rounded-full bg-menta transition-all"
            style={{ width: `${(checklist.doneCount / checklist.total) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-tinta-suave">
          {fs.progress(checklist.doneCount, checklist.total)}
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {checklist.items.map((item, index) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl border border-linha p-3 text-tinta no-underline transition-colors hover:bg-papel-2 ${
                item.done ? 'bg-menta-clara' : 'bg-cartao'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  item.done ? 'bg-menta text-tinta-fixa' : 'bg-papel-2 text-tinta-suave'
                }`}
              >
                {item.done ? '✓' : index + 1}
              </span>
              <span className="flex min-w-0 grow flex-col">
                <span className={`text-[15px] font-bold ${item.done ? 'line-through decoration-1 opacity-70' : ''}`}>
                  {fs.items[item.id].title}
                </span>
                <span className="text-[13px] leading-[18px] text-tinta-suave">{fs.items[item.id].desc}</span>
              </span>
              {item.done ? (
                <span className="shrink-0 text-xs font-bold text-verde-texto">{fs.doneTag}</span>
              ) : (
                <span className="shrink-0 text-tinta-suave" aria-hidden="true">
                  ›
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1">
          <ButtonLink href="/anotar" variant="laranja">
            {fs.tryFirstExpense}
          </ButtonLink>
        </div>
        <div className="flex-1">
          <ButtonLink href={firstLessonHref} variant="outline">
            {fs.exploreLesson}
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
  const emptyStatePlan = (forecast?.hasPlan || goalsForChecklist.length > 0 || progress.done.length > 0) && (
    <div className="flex flex-col gap-4">
      {forecast?.hasPlan && sectionsById.sobra}
      {goalsForChecklist.length > 0 && sectionsById.meta}
      {progress.done.length > 0 && sectionsById.aula}
    </div>
  );

  const restoreAlertsForm = prefs.fechados.length > 0 && (
    <form action={restoreDismissedAlerts} className="self-center">
      <button type="submit" className="min-h-11 text-[13px] font-semibold text-tinta-suave underline">
        {t.home.showDismissedAlerts(prefs.fechados.length)}
      </button>
    </form>
  );

  const customizeHomeLink = (
    <Link
      href="/inicio/personalizar"
      className="flex h-11 items-center justify-center gap-2 self-center rounded-full border border-linha px-4 text-[14px] font-semibold text-tinta no-underline"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </svg>
      {t.home.customizeHome}
    </Link>
  );

  const desktopTopCategories = topCategories.slice(0, 5);
  const desktopSpendingTotal = Math.max(
    1,
    summary.outcomeInCents || topCategories.reduce((sum, c) => sum + c.totalInCents, 0),
  );

  const desktopWhereItWentCard = (
    <section className="flex flex-col gap-4 rounded-[22px] border border-linha bg-cartao p-[22px]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[22px] leading-7 font-extrabold text-tinta">{t.home.whereItWentTitle}</h2>
        <Link href={`/carteira?mes=${month}`} className="text-sm font-semibold text-laranja-texto no-underline">
          {t.home.viewWallet}
        </Link>
      </div>
      {desktopTopCategories.length === 0 ? (
        <p className="text-sm text-tinta-suave">{t.home.noCategorizedExpenses(currentMonthLabel)}</p>
      ) : (
        <>
          <div
            className="flex h-[22px] gap-[3px] overflow-hidden rounded-full bg-papel-2"
            role="img"
            aria-label={desktopTopCategories
              .map((c) => `${c.name} ${Math.round((c.totalInCents / desktopSpendingTotal) * 100)}%`)
              .join(', ')}
          >
            {/* A cor de cada fatia é a da categoria (cat.color): bate 1:1 com a bolinha da legenda logo abaixo. */}
            {stackedSegments(desktopTopCategories, desktopSpendingTotal).map((seg) => (
              <Link
                key={seg.key}
                href={`/carteira?${new URLSearchParams({ mes: month, cat: seg.key })}#lista`}
                title={`${seg.name} · ${money(seg.totalInCents)} · ${seg.pct}%`}
                aria-label={`${seg.name} ${seg.pct}%`}
                data-segment-color={seg.color}
                className="h-full"
                style={{ width: `${seg.widthPct}%`, background: seg.color }}
              />
            ))}
          </div>
          <div className="flex flex-col">
            {desktopTopCategories.map((cat) => {
              const pct = Math.round((cat.totalInCents / desktopSpendingTotal) * 100);
              return (
                <Link
                  key={cat.categoryId}
                  href={`/carteira?${new URLSearchParams({ mes: month, cat: cat.categoryId ?? 'sem' })}#lista`}
                  className="flex min-h-[54px] items-center gap-3 border-b border-linha py-2 text-tinta no-underline last:border-b-0"
                >
                  <span
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-tinta-fixa"
                    style={{ background: cat.color || 'var(--color-papel-2)' }}
                    aria-hidden="true"
                  >
                    <CatIcon id={cat.categoryId ?? 'outros'} emoji={null} size={22} />
                  </span>
                  <div className="flex min-w-0 grow flex-col">
                    <span className="truncate text-[15px] font-semibold">{cat.name}</span>
                    <span className="text-xs text-tinta-suave">{t.home.percentOfSpending(pct)}</span>
                  </div>
                  <b className="shrink-0 text-[15px] font-bold tabular-nums">{money(cat.totalInCents)}</b>
                </Link>
              );
            })}
          </div>
        </>
      )}
      {summary.uncategorizedCount > 0 && (
        <Link
          href="/carteira?filtro=pendentes#lista"
          className="flex items-center justify-between gap-3 rounded-[14px] bg-amarelo-claro px-3.5 py-3 text-sm text-tinta no-underline"
        >
          <span>
            <b>{t.home.uncategorizedAlert(summary.uncategorizedCount)}</b>
          </span>
          <span className="shrink-0 font-semibold text-laranja-texto">{t.wallet.categorizeBadge}</span>
        </Link>
      )}
    </section>
  );

  const desktopInsightCard =
    deliveryCategory && deliveryCategory.totalInCents >= 10000 ? (
      <div className="flex items-center gap-2.5 rounded-[22px] bg-rosa p-[18px_20px_18px_10px] text-tinta">
        <Mascot pose="preocupado" size={110} alt="Tostão" />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="m-0 text-base leading-[23px]">
            <b>{t.home.deliveryAlert(money(deliveryCategory.totalInCents))}</b>. {t.nav.learnPrompt}
          </p>
          <Link
            href="/aprender/m1-l2"
            className="flex h-10 items-center self-start rounded-full bg-tinta px-[18px] text-sm font-semibold text-papel no-underline"
          >
            {t.home.viewLessonCta}
          </Link>
        </div>
      </div>
    ) : overBudgetCategory ? (
      <div className="flex items-center gap-2.5 rounded-[22px] bg-rosa p-[18px_20px_18px_10px] text-tinta">
        <Mascot pose="chocado" size={110} alt="Tostão" />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="m-0 text-base leading-[23px]">
            <b>
              {t.home.overBudgetAlert(
                overBudgetCategory.name,
                money(overBudgetCategory.spentInCents),
                money(overBudgetCategory.limitInCents),
              )}
            </b>
          </p>
          <Link
            href="/limites?voltar=/inicio"
            className="flex h-10 items-center self-start rounded-full bg-tinta px-[18px] text-sm font-semibold text-papel no-underline"
          >
            {t.home.limitsTitle}
          </Link>
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-2.5 rounded-[22px] bg-rosa p-[18px_20px_18px_10px] text-tinta">
        <Mascot pose="pensando" size={110} alt="Tostão" />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="m-0 text-base leading-[23px]">
            {t.home.chatPromptBody} <b>{t.home.chatPromptBold}</b>
          </p>
          <Link
            href="/tostao"
            className="flex h-10 items-center self-start rounded-full bg-tinta px-[18px] text-sm font-semibold text-papel no-underline"
          >
            {t.home.askTostao}
          </Link>
        </div>
      </div>
    );

  const railGoalCard = forecast ? (
    sectionsById.meta
  ) : (
    <Link
      href="/meta?voltar=/inicio"
      className="flex items-center gap-3 rounded-2xl border border-dashed border-linha bg-cartao p-3.5 text-[15px] text-tinta no-underline"
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

  const topFriends = friends?.ranking.slice(0, 3) ?? [];
  const weeklyChallengeCard = (
    <Link
      href="/amigos?voltar=/inicio"
      className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5 text-tinta no-underline transition hover:bg-papel-2/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          {t.weeklyChallenge.eyebrow}
        </span>
        <span className="text-xs font-semibold text-laranja-texto">{t.weeklyChallenge.openRanking}</span>
      </div>
      {friends?.challenge.title && (
        <span className="text-[15px] leading-5 font-bold text-tinta">{friends.challenge.title}</span>
      )}
      {topFriends.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {topFriends.map((person, index) => (
            <div key={person.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-papel-2 text-[11px] font-bold text-tinta">
                  {index + 1}
                </span>
                <span className={`truncate ${person.me ? 'font-bold text-tinta' : 'font-medium text-tinta'}`}>
                  {person.name}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-tinta-suave tabular-nums">
                <span>{person.weekScore} pts</span>
                <span className="inline-flex items-center gap-0.5">
                  <Icon src="ui/ofensiva" size={14} />
                  {t.engagement.daysCount(person.streakDays)}
                </span>
              </span>
            </div>
          ))}
          {friends && friends.ranking.length <= 1 && (
            <p className="text-xs leading-[17px] text-tinta-suave">{t.weeklyChallenge.emptyRank}</p>
          )}
        </div>
      ) : (
        <p className="text-[13px] leading-[18px] text-tinta-suave">{t.weeklyChallenge.emptyRank}</p>
      )}
    </Link>
  );

  const rightRail = (
    <>
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{t.nav.learnHeader}</span>
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-amarelo-claro p-4">
        <Mascot pose="professor" size={96} alt="Tostão" />
        <span className="text-xs font-semibold text-tinta-suave">
          {atual ? t.home.learnModuleProgress(atual.number, feitas, atual.lessons.length) : t.home.allModulesCompleted}
        </span>
        <span className="font-display text-[22px] leading-[26px] font-extrabold text-tinta">
          {atual?.title ?? t.home.allModulesCompleted}
        </span>
        {atual && (
          <div
            className="flex gap-[5px]"
            role="img"
            aria-label={t.home.learnModuleProgress(atual.number, feitas, atual.lessons.length)}
          >
            {atual.lessons.map((lesson) => (
              <i
                key={lesson.id}
                className={`h-2 flex-1 rounded-full ${progress.done.includes(lesson.id) ? 'bg-tinta' : 'bg-cartao'}`}
              />
            ))}
          </div>
        )}
        <Link
          href={proxima ? `/aprender/${proxima.id}` : '/aprender/trilha'}
          className="flex h-11 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel no-underline"
        >
          {t.nav.continueLesson}
        </Link>
      </div>
      {railGoalCard}
      {weeklyChallengeCard}
    </>
  );

  const monthSelectorLabel =
    month.slice(0, 4) === hoje.slice(0, 4)
      ? capitalize(currentMonthLabel)
      : `${capitalize(currentMonthLabel)} ${month.slice(0, 4)}`;
  const prevMes = shiftMonth(month, -1);
  const nextMes = shiftMonth(month, 1);
  const canGoNext = month < hoje;

  // Um seletor só: no mobile fica claro (bg-papel-2), no desktop escuro (bg-tinta), por classes `lg:`.
  const chevronLink =
    'flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-linha/60 lg:hover:bg-papel/15';
  const monthSelector = (
    <div className="inline-flex h-10 items-center gap-0.5 rounded-full bg-papel-2 px-1 text-sm font-bold text-tinta lg:gap-1 lg:bg-tinta lg:px-1.5 lg:font-semibold lg:text-papel">
      <Link href={`/inicio?mes=${prevMes}`} aria-label={t.walletExtra.main.prevMonth} className={chevronLink}>
        <MonthChevron d="M15 18l-6-6 6-6" />
      </Link>
      <span className="px-2 whitespace-nowrap">{monthSelectorLabel}</span>
      {canGoNext ? (
        <Link
          href={nextMes === hoje ? '/inicio' : `/inicio?mes=${nextMes}`}
          aria-label={t.walletExtra.main.nextMonth}
          className={chevronLink}
        >
          <MonthChevron d="M9 18l6-6-6-6" />
        </Link>
      ) : (
        <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full opacity-25">
          <MonthChevron d="M9 18l6-6-6-6" />
        </span>
      )}
    </div>
  );

  return (
    <DesktopSplitShell rightWidth={320} right={rightRail}>
      {missions && (
        <MissionCompletionToast
          day={todayIso()}
          done={missions.missions.filter((m) => m.done).length}
          streak={missions.streakDays}
          locale={locale}
        />
      )}

      {/*
        Uma árvore só pro que é igual nos dois tamanhos (cabeçalho, alertas, estado vazio, achados do Tostão): esses
        componentes têm estado e efeitos, então não podem montar duas vezes. O que muda de verdade (cartão de saldo e
        corpo da página) fica em dois blocos exibidos por CSS (`lg:`).
      */}
      <div className="flex flex-col gap-6 lg:gap-7">
        <header className="flex items-center justify-between gap-2 lg:gap-4">
          {monthSelector}
          <div className="flex shrink-0 items-center gap-2">
            <StreakModalButton
              days={missions?.streakDays ?? progress.streakDays}
              missions={missions}
              locale={locale}
              label={t.nav.streakDays(missions?.streakDays ?? progress.streakDays)}
            />
          </div>
        </header>

        {brokenConnectionsAlert}

        <PwaInstallBanner locale={locale} />

        {isEmptyState ? (
          <>
            {emptyStateCard}
            {emptyStatePlan}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:hidden">{balanceCard}</div>
            {/* Mobile: anotar vira botão flutuante (a aba Tostão da barra de baixo já cobre o "perguntar pro Tostão"). */}
            <QuickAddButton variant="fab" label={t.nav.addExpense} locale={locale} />
            <div className="hidden lg:block">
              <DesktopBalanceRow {...balanceProps} />
            </div>

            {/* Um quadro só (e no máximo 2 achados): o que ele já diz não se repete nos avisos abaixo. */}
            {isSectionVisible('avisos') && auto && unified.insights.length > 0 && (
              <TostaoFindingsBoard
                initial={{ ...auto, insights: unified.insights }}
                locale={locale}
                compact
                seeAllHref="/tostao?aba=automatico"
              />
            )}

            {/* Mobile & Tablet (< lg) */}
            <div className="flex min-w-0 flex-col gap-6 pb-16 lg:hidden">
              {visibleSections.map((id) => (
                <Fragment key={id}>{sectionsById[id]}</Fragment>
              ))}

              {restoreAlertsForm}
              {customizeHomeLink}
            </div>

            {/* Desktop (lg+) */}
            <div className="hidden lg:flex lg:flex-col lg:gap-7">
              {isSectionVisible('atalhos') && sectionsById.atalhos}

              <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-[18px]">
                  {isSectionVisible('pra-onde-foi') && desktopWhereItWentCard}
                  {visibleSections
                    .filter((id) => DESKTOP_LEFT_EXTRAS.has(id))
                    .map((id) => (
                      <Fragment key={id}>{sectionsById[id]}</Fragment>
                    ))}
                </div>

                <div className="flex min-w-0 flex-col gap-[18px]">
                  {isSectionVisible('avisos') &&
                    (unified.local.includes('deliveryTip') || unified.local.includes('overBudget')) &&
                    desktopInsightCard}
                  <AskTostaoCard locale={locale} />
                  {isSectionVisible('semana') && sectionsById.semana}
                  {isSectionVisible('avisos') &&
                    unified.local
                      // Dica de delivery e limite estourado já estão no cartão do topo; pendentes já estão no "Pra onde foi".
                      .filter(
                        (k) =>
                          k !== 'deliveryTip' &&
                          k !== 'overBudget' &&
                          !(k === 'uncategorized' && isSectionVisible('pra-onde-foi')),
                      )
                      .map((k) => <Fragment key={k}>{localAlertNodes[k]}</Fragment>)}
                  <div className="flex flex-col items-center gap-2 pt-1">
                    {restoreAlertsForm}
                    {customizeHomeLink}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DesktopSplitShell>
  );
}
