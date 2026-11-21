import { Fragment } from 'react';
import Link from 'next/link';
import type {
  BudgetsResponse,
  ForecastResponse,
  FriendsResponse,
  LessonProgressResponse,
  MissionsResponse,
  MonthSummaryResponse,
  PeopleResponse,
  ProfileResponse,
  RemindersResponse,
  SubscriptionsResponse,
  TostaoAutoResponse,
  WeeklyResponse,
} from '@tostao/contracts';
import { CardNetworkBadge, getBankLogos, BankBadge } from '@/components/banco';
import { BudgetBar } from '@/components/budget-bar';
import { MonthLeftoverCard, UpcomingReminders, WeeklySummaryCard } from '@/components/engajamento';
import { DismissibleCard } from '@/components/fechavel';
import { CatIcon, Icon } from '@/components/icone';
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
import { AskTostaoCard } from './ask-card';
import { DesktopBalanceRow, MobileBalanceCard, type BalanceCardProps } from './balance-card';
import { PlanejarAtalhos } from './planejar-atalhos';

const BAR_SEGMENT_CLASSES = ['bg-laranja', 'bg-tinta', 'bg-menta', 'bg-amarelo', 'bg-tinta-suave'] as const;
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

  const [
    profile,
    summary,
    subscriptions,
    budgetsData,
    progress,
    forecast,
    missions,
    remindersData,
    weekly,
    bankLogos,
    splits,
    auto,
    friends,
  ] = await Promise.all([
    api<ProfileResponse>('/me'),
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
    api<BudgetsResponse>(`/budgets?month=${month}`).catch(() => ({ budgets: [] })),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<ForecastResponse>('/forecast').catch(() => null),
    api<MissionsResponse>('/missions').catch(() => null),
    api<RemindersResponse>('/reminders').catch(() => ({ reminders: [] })),
    api<WeeklyResponse>('/weekly').catch(() => null),
    getBankLogos(),
    api<PeopleResponse>('/people').catch(() => null),
    api<TostaoAutoResponse>('/tostao/auto').catch(() => null),
    api<FriendsResponse>('/friends').catch(() => null),
  ]);

  const overBudgetCategory = budgetsData.budgets.find((b) => b.spentInCents > b.limitInCents);
  const activeSubscriptionCount = subscriptions?.subscriptions.filter((sub) => sub.active).length ?? 0;
  const currentMonthLabel = monthName(month, locale);
  const topCategories = summary.byCategory.filter((c) => c.categoryId);
  const maxCategorySpend = Math.max(1, ...summary.byCategory.map((c) => c.totalInCents));
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
  const isMonthInGreen = summary.incomeInCents >= summary.outcomeInCents;
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
      <>{<UpcomingReminders reminders={remindersData.reminders.filter((r) => isAlertOpen(r.key))} locale={locale} />}</>
    ),
    avisos: (
      <>
        {uncategorizedAlertCard}
        {isAlertOpen(tipKey) && deliveryCategory && deliveryCategory.totalInCents >= 10000 ? (
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
        ) : null}
        {overBudgetCategory && isAlertOpen(`estourou:${overBudgetCategory.categoryId}:${month}`) && (
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
        )}
        {monthlyClosingAlert}
        {subscriptionsAlert}
      </>
    ),
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
        <div className="flex flex-col gap-3">
          {topCategories.slice(0, 5).map((cat, idx) => (
            <Link
              key={cat.categoryId}
              href={`/carteira?${new URLSearchParams({ mes: month, cat: cat.categoryId ?? 'sem' })}#lista`}
              className="flex flex-col gap-1.5 text-tinta no-underline"
            >
              <div className="flex justify-between text-[15px] font-semibold">
                <span>{cat.name}</span>
                <span className="tabular-nums">{money(cat.totalInCents)} ›</span>
              </div>
              <div className="h-2.5 rounded-full bg-papel-2">
                <div
                  className={`bar-fill h-full rounded-full ${idx === 0 ? 'bg-laranja' : 'bg-tinta'}`}
                  style={{ width: `${Math.max(2, (cat.totalInCents / maxCategorySpend) * 100)}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>
    ),
    semana: (
      <>
        {weekly && isAlertOpen(`semana:${weekly.from}`) && (
          <DismissibleCard id={`semana:${weekly.from}`} label={t.home.dismissAlertLabel}>
            <WeeklySummaryCard w={weekly} locale={locale} />
          </DismissibleCard>
        )}
      </>
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
                      {t.home.youOwe} <b className="text-vermelho-texto tabular-nums">{money(splits.youOweInCents)}</b>
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

  const emptyStateCard = (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <Mascot pose="dormindo" size={180} alt="Tostão" />
      <h2 className="font-display text-2xl font-extrabold">{t.home.emptyTitle}</h2>
      <p className="max-w-[300px] text-[15px] text-tinta-suave">{t.home.emptyDescription}</p>
      <div className="mt-2 flex w-full max-w-sm flex-col gap-2.5">
        <ButtonLink href="/conectar" variant="laranja">
          {t.home.connectExpensesCta}
        </ButtonLink>
        <ButtonLink href="/anotar" variant="outline">
          {t.home.logManualExpenseCta}
        </ButtonLink>
      </div>
    </Card>
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
  const desktopBarTotal = Math.max(
    1,
    desktopTopCategories.reduce((sum, c) => sum + c.totalInCents, 0),
  );
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
            {desktopTopCategories.map((cat, idx) => (
              <div
                key={cat.categoryId}
                className={`h-full ${BAR_SEGMENT_CLASSES[idx % BAR_SEGMENT_CLASSES.length]}`}
                style={{ width: `${Math.max(2, (cat.totalInCents / desktopBarTotal) * 100)}%` }}
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

  const renderMonthSelector = (variant: 'mobile' | 'desktop') => (
    <div
      className={`inline-flex h-10 items-center rounded-full text-sm ${
        variant === 'desktop'
          ? 'gap-1 bg-tinta px-1.5 font-semibold text-papel'
          : 'gap-0.5 bg-papel-2 px-1 font-bold text-tinta'
      }`}
    >
      <Link
        href={`/inicio?mes=${prevMes}`}
        aria-label={t.walletExtra.main.prevMonth}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          variant === 'desktop' ? 'hover:bg-papel/15' : 'hover:bg-linha/60'
        }`}
      >
        <MonthChevron d="M15 18l-6-6 6-6" />
      </Link>
      <span className="px-2 whitespace-nowrap">{monthSelectorLabel}</span>
      {canGoNext ? (
        <Link
          href={nextMes === hoje ? '/inicio' : `/inicio?mes=${nextMes}`}
          aria-label={t.walletExtra.main.nextMonth}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            variant === 'desktop' ? 'hover:bg-papel/15' : 'hover:bg-linha/60'
          }`}
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

      {/* Mobile & Tablet (< lg) */}
      <div className="flex flex-col gap-6 lg:hidden">
        <header className="flex items-center justify-between gap-2">
          {renderMonthSelector('mobile')}
          <div className="shrink-0">
            <StreakModalButton
              days={missions?.streakDays ?? progress.streakDays}
              missions={missions}
              locale={locale}
              label={t.nav.streakDays(missions?.streakDays ?? progress.streakDays)}
            />
          </div>
        </header>

        {brokenConnectionsAlert}

        {isEmptyState && emptyStateCard}

        {!isEmptyState && (
          <>
            {balanceCard}
            {auto && auto.insights.length > 0 && (
              <TostaoFindingsBoard initial={auto} locale={locale} compact seeAllHref="/tostao?aba=automatico" />
            )}
            {visibleSections.map((id) => (
              <Fragment key={id}>{sectionsById[id]}</Fragment>
            ))}

            {restoreAlertsForm}
            {customizeHomeLink}
          </>
        )}
      </div>

      {/* Desktop (lg+) */}
      <div className="hidden lg:flex lg:flex-col lg:gap-7">
        <header className="flex items-center justify-between gap-4">
          {renderMonthSelector('desktop')}
          <div className="flex shrink-0 items-center gap-2">
            <StreakModalButton
              days={missions?.streakDays ?? progress.streakDays}
              missions={missions}
              locale={locale}
              label={t.nav.streakDays(missions?.streakDays ?? progress.streakDays)}
            />
            <span
              className={`flex h-10 items-center rounded-full px-4 text-sm font-bold ${
                isMonthInGreen ? 'bg-menta-clara text-verde-texto' : 'bg-rosa text-vermelho-texto'
              }`}
            >
              {isMonthInGreen ? t.home.monthInGreen : t.home.monthTight}
            </span>
          </div>
        </header>

        {brokenConnectionsAlert}

        {isEmptyState ? (
          emptyStateCard
        ) : (
          <>
            <DesktopBalanceRow {...balanceProps} />

            {auto && auto.insights.length > 0 && (
              <TostaoFindingsBoard initial={auto} locale={locale} compact seeAllHref="/tostao?aba=automatico" />
            )}

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
                {desktopInsightCard}
                <AskTostaoCard locale={locale} />
                {isSectionVisible('semana') && sectionsById.semana}
                {isSectionVisible('avisos') && (
                  <>
                    {!isSectionVisible('pra-onde-foi') && uncategorizedAlertCard}
                    {monthlyClosingAlert}
                    {subscriptionsAlert}
                  </>
                )}
                <div className="flex flex-col items-center gap-2 pt-1">
                  {restoreAlertsForm}
                  {customizeHomeLink}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DesktopSplitShell>
  );
}
