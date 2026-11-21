import type {
  BudgetDTO,
  FinancialPlan,
  ForecastResponse,
  MonthSummaryResponse,
  PeopleResponse,
  SubscriptionsResponse,
} from '@tostao/contracts';
import { money, monthName, shiftMonth } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n';
import { PlannerCardGrid, type PlannerCardViewItem } from './planner-card-grid';

type PlannerCardItem = PlannerCardViewItem;

function goalKindFallback(kind: NonNullable<FinancialPlan['goal']>['kind'], locale: Locale): string {
  if (locale === 'en') {
    if (kind === 'reserva') return 'Emergency fund';
    if (kind === 'viagem') return 'Trip';
    if (kind === 'sair-do-vermelho') return 'Get out of debt';
    return 'Personal goal';
  }
  if (locale === 'es') {
    if (kind === 'reserva') return 'Fondo de emergencia';
    if (kind === 'viagem') return 'Viaje';
    if (kind === 'sair-do-vermelho') return 'Salir del rojo';
    return 'Meta personal';
  }
  if (kind === 'reserva') return 'Reserva de emergência';
  if (kind === 'viagem') return 'Viagem';
  if (kind === 'sair-do-vermelho') return 'Sair do vermelho';
  return 'Meta pessoal';
}

export function PlannerHub({
  plan,
  forecast,
  budgets,
  subscriptions,
  people,
  summary,
  month,
  locale,
  t,
}: {
  plan: FinancialPlan | null;
  forecast: ForecastResponse | null;
  budgets: BudgetDTO[];
  subscriptions: SubscriptionsResponse | null;
  people: PeopleResponse | null;
  summary: MonthSummaryResponse;
  month: string;
  locale: Locale;
  t: Dictionary;
}) {
  const pc = t.plannerCards;

  // 1. Renda e contas fixas
  const salaryCents = plan?.salary?.amountInCents ?? 0;
  const otherIncomeCents = (plan?.otherIncomes ?? [])
    .filter((o) => o.countsAsIncome)
    .reduce((sum, o) => sum + o.amountInCents, 0);
  const totalIncomeCents = salaryCents + otherIncomeCents;
  const fixedExpenses = plan?.fixedExpenses ?? [];
  const fixedTotalCents = fixedExpenses.reduce((sum, f) => sum + f.amountInCents, 0);

  const incomeHeadline = salaryCents > 0 ? money(salaryCents) : totalIncomeCents > 0 ? money(totalIncomeCents) : null;
  const incomeSummary =
    salaryCents > 0
      ? fixedExpenses.length > 0
        ? pc.fixedBillCount(fixedExpenses.length, money(fixedTotalCents))
        : otherIncomeCents > 0
          ? pc.otherIncomePlus(money(otherIncomeCents))
          : pc.salarySetHint
      : totalIncomeCents > 0
        ? pc.fixedBillCount(fixedExpenses.length, money(fixedTotalCents))
        : fixedExpenses.length > 0
          ? pc.fixedNeedIncome(fixedExpenses.length)
          : pc.incomeEmptySummary;

  // 2. Previsão (3 meses)
  const thisMonth = forecast?.thisMonth ?? null;
  const nextMonth = forecast?.months?.[0] ?? null;
  const forecastHeadline = thisMonth
    ? (thisMonth.leftInCents >= 0 ? pc.forecastLeft : pc.forecastShort)(money(Math.abs(thisMonth.leftInCents)))
    : nextMonth
      ? (nextMonth.leftInCents >= 0 ? pc.forecastLeft : pc.forecastShort)(money(Math.abs(nextMonth.leftInCents)))
      : null;
  const forecastSummary = thisMonth
    ? pc.forecastThisSummary(
        monthName(thisMonth.month, locale),
        nextMonth
          ? ` · ${monthName(nextMonth.month, locale)}: ${nextMonth.leftInCents >= 0 ? '+' : '−'}${money(Math.abs(nextMonth.leftInCents))}`
          : '',
      )
    : nextMonth
      ? pc.forecastNextSummary(monthName(nextMonth.month, locale))
      : pc.forecastEmptySummary;
  const forecastBadge: PlannerCardItem['badge'] = thisMonth
    ? {
        text: thisMonth.leftInCents >= 0 ? pc.badgeInGreen : pc.badgeAttention,
        tone: thisMonth.leftInCents >= 0 ? 'positive' : 'alert',
      }
    : nextMonth
      ? {
          text: nextMonth.leftInCents >= 0 ? pc.badgeInGreen : pc.badgeAttention,
          tone: nextMonth.leftInCents >= 0 ? 'positive' : 'alert',
        }
      : { text: pc.badgeConfigIncome, tone: 'neutral' };

  // 3. Limites do mês
  const budgetCount = budgets.length;
  const overBudgetCount = budgets.filter((b) => b.spentInCents > b.limitInCents).length;
  const nearBudgetCount = budgets.filter(
    (b) => b.spentInCents <= b.limitInCents && b.spentInCents >= b.limitInCents * 0.85,
  ).length;
  const budgetHeadline = budgetCount > 0 ? pc.activeLimitsCount(budgetCount) : null;
  const budgetSummary =
    budgetCount === 0
      ? pc.limitsEmptySummary
      : overBudgetCount > 0
        ? pc.limitsOverSummary(overBudgetCount)
        : nearBudgetCount > 0
          ? pc.limitsNearSummary(nearBudgetCount)
          : pc.limitsOkSummary;
  const budgetBadge: PlannerCardItem['badge'] =
    budgetCount === 0
      ? { text: pc.badgeSet, tone: 'neutral' }
      : overBudgetCount > 0
        ? { text: pc.badgeOverLimit(overBudgetCount), tone: 'alert' }
        : nearBudgetCount > 0
          ? { text: pc.badgeNear(nearBudgetCount), tone: 'warning' }
          : { text: pc.badgeOnTrack, tone: 'positive' };

  // 4. Minhas assinaturas
  const activeSubs = (subscriptions?.subscriptions ?? []).filter((s) => s.active);
  const subsMonthly = subscriptions?.monthlyInCents ?? activeSubs.reduce((sum, s) => sum + s.amountInCents, 0);
  const duplicateSubs = activeSubs.filter((s) => s.duplicateOf).length;
  const subsHeadline = subscriptions && activeSubs.length > 0 ? pc.subsPerMonth(money(subsMonthly)) : null;
  const subsSummary =
    subscriptions && activeSubs.length > 0
      ? pc.subsSummary(activeSubs.length, duplicateSubs)
      : subscriptions
        ? pc.subsEmptySummary
        : pc.subsFallbackSummary;

  // 5. Minhas metas
  const goalsList =
    forecast?.goals && forecast.goals.length > 0 ? forecast.goals : forecast?.goal ? [forecast.goal] : [];
  const goalStatus = goalsList[0] ?? null;
  const rawGoal = plan?.goal ?? null;
  const hasGoal = goalsList.length > 0 || Boolean(rawGoal);
  const goalTitle = goalStatus?.label ?? rawGoal?.label ?? (rawGoal ? goalKindFallback(rawGoal.kind, locale) : null);
  const goalSaved =
    goalsList.length > 0 ? goalsList.reduce((sum, g) => sum + g.savedInCents, 0) : (rawGoal?.savedInCents ?? 0);
  const goalTarget =
    goalsList.length > 0
      ? goalsList.every((g) => g.amountInCents !== null)
        ? goalsList.reduce((sum, g) => sum + (g.amountInCents ?? 0), 0)
        : (goalStatus?.amountInCents ?? null)
      : (rawGoal?.amountInCents ?? null);
  const goalPct = goalTarget && goalTarget > 0 ? Math.min(100, Math.round((goalSaved / goalTarget) * 100)) : null;
  const goalHeadline = hasGoal
    ? goalTarget
      ? `${money(goalSaved)} / ${money(goalTarget)}`
      : pc.goalSavedOnly(money(goalSaved))
    : null;
  const goalSummary =
    goalsList.length > 1
      ? locale === 'en'
        ? `${goalsList.length} active goals`
        : locale === 'es'
          ? `${goalsList.length} metas activas`
          : `${goalsList.length} metas ativas`
      : hasGoal
        ? `${goalTitle ?? goalKindFallback('outro', locale)}${goalStatus?.monthlyNeededInCents ? pc.goalMonthlySave(money(goalStatus.monthlyNeededInCents)) : ''}`
        : pc.goalEmptySummary;
  const goalBadge: PlannerCardItem['badge'] =
    goalsList.length > 0 && goalsList.every((g) => g.reached)
      ? { text: pc.goalReachedBadge, tone: 'positive' }
      : goalPct !== null
        ? { text: `${goalPct}%`, tone: 'neutral' }
        : !hasGoal
          ? { text: pc.goalCreateBadge, tone: 'neutral' }
          : undefined;

  // 6. Acertos
  const owedToYou = people?.owedToYouInCents ?? 0;
  const youOwe = people?.youOweInCents ?? 0;
  const peopleCount = people?.people.length ?? 0;
  const splitsHeadline =
    owedToYou > 0 && youOwe > 0
      ? `+${money(owedToYou)} / −${money(youOwe)}`
      : owedToYou > 0
        ? pc.splitsOwedHeadline(money(owedToYou))
        : youOwe > 0
          ? pc.splitsOweHeadline(money(youOwe))
          : null;
  const splitsSummary =
    owedToYou > 0 && youOwe > 0
      ? pc.splitsBothSummary(money(owedToYou), money(youOwe))
      : owedToYou > 0 || youOwe > 0
        ? pc.splitsOpenSummary(peopleCount)
        : peopleCount > 0
          ? pc.splitsSettledSummary(peopleCount)
          : pc.splitsEmptySummary;

  // 7. Minhas categorias
  const pendingCount = summary.uncategorizedCount;
  const categoriesSummary = pendingCount > 0 ? pc.categoriesPendingSummary(pendingCount) : pc.categoriesCleanSummary;

  // 8. Fechamento do mês
  const prevClosedMonth = shiftMonth(month, -1);
  const closingSummary =
    summary.incomeInCents > 0 || summary.outcomeInCents > 0
      ? pc.closingActiveSummary(
          monthName(prevClosedMonth, locale),
          monthName(month, locale),
          money(summary.outcomeInCents),
        )
      : pc.closingEmptySummary(monthName(prevClosedMonth, locale));

  const cards: PlannerCardItem[] = [
    {
      id: 'renda',
      href: '/renda?voltar=/carteira?aba=planejar',
      icon: 'cat/salario',
      iconBg: 'bg-menta-clara text-verde-texto',
      title: pc.titles.income,
      headline: incomeHeadline,
      summary: incomeSummary,
      badge: salaryCents === 0 && totalIncomeCents === 0 ? { text: pc.incomeBadgeNeed, tone: 'warning' } : undefined,
    },
    {
      id: 'previsao',
      href: '/previsao?voltar=/carteira?aba=planejar',
      icon: 'modulo/8',
      iconBg: 'bg-azul text-tinta',
      title: pc.titles.forecast,
      headline: forecastHeadline,
      summary: forecastSummary,
      badge: forecastBadge,
    },
    {
      id: 'limites',
      href: '/limites?voltar=/carteira?aba=planejar',
      icon: 'modulo/9',
      iconBg: 'bg-amarelo-claro text-tinta',
      title: pc.titles.limits,
      headline: budgetHeadline,
      summary: budgetSummary,
      badge: budgetBadge,
    },
    {
      id: 'assinaturas',
      href: '/assinaturas?voltar=/carteira?aba=planejar',
      icon: 'cat/assinaturas',
      iconBg: 'bg-papel-2 text-tinta',
      title: pc.titles.subscriptions,
      headline: subsHeadline,
      summary: subsSummary,
      badge: duplicateSubs > 0 ? { text: pc.subsDuplicateBadge(duplicateSubs), tone: 'warning' } : undefined,
    },
    {
      id: 'meta',
      href: '/meta?voltar=/carteira?aba=planejar',
      icon: 'meta/outro',
      iconBg: 'bg-menta-clara text-tinta',
      title: pc.titles.goal,
      headline: goalHeadline,
      summary: goalSummary,
      badge: goalBadge,
      progressPct: goalPct,
    },
    {
      id: 'acertos',
      href: '/acertos?voltar=/carteira?aba=planejar',
      icon: 'cat/role',
      iconBg: 'bg-azul text-tinta',
      title: pc.titles.splits,
      headline: splitsHeadline,
      summary: splitsSummary,
      badge:
        youOwe > 0 && owedToYou === 0
          ? { text: pc.splitsPayBadge, tone: 'warning' }
          : owedToYou > 0 && youOwe === 0
            ? { text: pc.splitsReceiveBadge, tone: 'positive' }
            : undefined,
    },
    {
      id: 'categorias',
      href: '/categorias?voltar=/carteira?aba=planejar',
      icon: 'ui/minhas-categorias',
      iconBg: 'bg-papel-2 text-tinta',
      title: pc.titles.categories,
      headline: null,
      summary: categoriesSummary,
      badge: pendingCount > 0 ? { text: pc.categoriesPendingBadge(pendingCount), tone: 'warning' } : undefined,
    },
    {
      id: 'anotacoes',
      href: '/anotacoes?voltar=/carteira?aba=planejar',
      icon: 'conectar/anotar',
      iconBg: 'bg-laranja text-papel',
      title: pc.titles.notes,
      headline: null,
      summary: pc.notesSummary,
    },
    {
      id: 'fechamento',
      href: '/fechamento?voltar=/carteira?aba=planejar',
      icon: 'ui/meta-batida',
      iconBg: 'bg-amarelo-claro text-tinta',
      title: pc.titles.closing,
      headline: null,
      summary: closingSummary,
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4 pb-8">
      <h2 className="font-display text-[22px] leading-7 font-extrabold text-tinta">{t.planner.title}</h2>

      <PlannerCardGrid
        cards={cards.map((c) => ({ ...c, moreInfoAria: pc.moreInfoAria(c.title) }))}
        openCardLabel={pc.openCard}
      />
    </section>
  );
}
