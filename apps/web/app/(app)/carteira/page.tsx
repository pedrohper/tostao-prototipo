import { ReconcileBalanceCard, type ReconcileAccount } from '@/components/reconcile-balance-card';
import { CardNetworkBadge, BankBadge } from '@/components/banco';
import { getBankLogos } from '@/lib/api-queries';
import Link from 'next/link';
import {
  isYieldTransaction,
  type BudgetsResponse,
  type CategoryDTO,
  type FinancialPlanResponse,
  type ForecastResponse,
  type MonthSummaryResponse,
  type PeopleResponse,
  type SubscriptionsResponse,
  type TransactionDTO,
} from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, dayLabel, money, monthName, shiftMonth, shortDate, updatedTimeLabel } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { ButtonLink, Eyebrow } from '@/components/ui';
import { Mascot } from '@/components/mascote';
import { BudgetProgressBar } from '@/components/graficos';
import { DesktopSplitShell } from '@/components/lateral';
import { AutoCategorizeButton } from './auto-categorize-button';
import { CategorizeQueue } from './categorize-queue';
import { QuickAddButton } from '@/components/quick-add-sheet';
import { cleanQuery, matchesQuery } from '@/lib/wallet-search';
import { PlannerHub } from './planner-hub';
import { Simulacao } from './simulacao';
import { Chevron, ExtratoHeaderBar, FilterDropdown, Row } from './transaction-row';
import { getMe } from '@/lib/api-queries';

const FILTER_KEYS = ['tudo', 'saidas', 'entradas', 'a-pagar', 'a-receber', 'pendentes'] as const;
type Filter = (typeof FILTER_KEYS)[number];
type Aba = 'extrato' | 'contas' | 'planejar';

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    mes?: string;
    filtro?: string;
    cat?: string;
    categoria?: string;
    conta?: string;
    semEntreContas?: string;
    semRendimentos?: string;
    q?: string;
    modo?: string;
  }>;
}) {
  const [{ locale, t }, sp] = await Promise.all([getI18n(), searchParams]);
  const tw = t.walletExtra.main;
  const aba: Aba = sp.aba === 'contas' ? 'contas' : sp.aba === 'planejar' ? 'planejar' : 'extrato';
  const hoje = currentMonth();
  const rawMes = sp.mes === 'futuro' ? shiftMonth(hoje, 1) : sp.mes;
  const month = /^\d{4}-\d{2}$/.test(rawMes ?? '') ? rawMes! : hoje;
  const filter: Filter =
    sp.filtro && (FILTER_KEYS as readonly string[]).includes(sp.filtro) ? (sp.filtro as Filter) : 'tudo';

  // Mês que ainda não chegou no extrato: simulação com a previsão (até 3 meses pra frente).
  if (aba === 'extrato' && month > hoje) {
    const futuro = month > shiftMonth(hoje, 3) ? shiftMonth(hoje, 3) : month;
    const [forecast, logos] = await Promise.all([api<ForecastResponse>('/forecast'), getBankLogos()]);
    return <Simulacao month={futuro} hoje={hoje} forecast={forecast} logos={logos} locale={locale} t={t} />;
  }

  const statementMonth = month > hoje ? hoje : month;

  const categorizeMode = sp.modo === 'categorizar' && aba === 'extrato';
  const [{ transactions }, summary, logos, profile, plannerData, categoriesData] = await Promise.all([
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${statementMonth}`),
    api<MonthSummaryResponse>(`/summary?month=${statementMonth}`),
    getBankLogos(),
    aba === 'contas' ? getMe().catch(() => null) : Promise.resolve(null),
    aba === 'planejar'
      ? Promise.all([
          api<FinancialPlanResponse>('/plan').catch(() => null),
          api<ForecastResponse>('/forecast').catch(() => null),
          api<BudgetsResponse>(`/budgets?month=${statementMonth}`).catch(() => null),
          api<SubscriptionsResponse>('/subscriptions').catch(() => null),
          api<PeopleResponse>('/people').catch(() => null),
        ])
      : Promise.resolve(null),
    categorizeMode ? api<{ categories: CategoryDTO[] }>('/categories').catch(() => null) : Promise.resolve(null),
  ]);

  // Categoria escolhida: só os gastos dela ("sem" = sem categoria).
  const rawCat = sp.cat ?? sp.categoria;
  const cat = rawCat && /^[\w-]{1,60}$/.test(rawCat) ? rawCat : null;
  const conta = sp.conta?.trim() ? sp.conta.trim().slice(0, 80) : null;
  const search = cleanQuery(sp.q);
  const hideTransfers = sp.semEntreContas === '1';
  const hideYields = sp.semRendimentos === '1';
  const catInfo = cat ? (summary.byCategory.find((c) => (c.categoryId ?? 'sem') === cat) ?? null) : null;
  const shown = transactions.filter((tx) => {
    if (hideTransfers && tx.isInternalTransfer) return false;
    if (hideYields && isYieldTransaction(tx)) return false;
    if (conta && tx.accountName !== conta) return false;
    if (search && !matchesQuery(tx, search)) return false;
    if (cat)
      return !tx.isInternalTransfer && (tx.categoryId ?? 'sem') === cat && (cat !== 'sem' || tx.amountInCents < 0);
    if (filter === 'saidas') return tx.amountInCents < 0 && !tx.isInternalTransfer;
    if (filter === 'entradas') return tx.amountInCents > 0 && !tx.isInternalTransfer;
    if (filter === 'a-pagar') return tx.amountInCents < 0 && !tx.isInternalTransfer && tx.settled === false;
    if (filter === 'a-receber') return tx.amountInCents > 0 && !tx.isInternalTransfer && tx.settled === false;
    if (filter === 'pendentes') return !tx.categoryId && !tx.isInternalTransfer;
    return true;
  });

  const groups = new Map<string, TransactionDTO[]>();
  for (const tx of shown) {
    const k = dayLabel(tx.occurredAt, locale);
    groups.set(k, [...(groups.get(k) ?? []), tx]);
  }

  const buildHref = (overrides: Record<string, string | null | undefined>) => {
    const next: Record<string, string | undefined> = {
      ...(aba !== 'extrato' ? { aba } : {}),
      mes: statementMonth,
      filtro: filter,
      ...(cat ? { cat } : {}),
      ...(conta ? { conta } : {}),
      ...(search ? { q: search } : {}),
      ...(hideTransfers ? { semEntreContas: '1' } : {}),
      ...(hideYields ? { semRendimentos: '1' } : {}),
    };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === undefined || v === '') delete next[k];
      else next[k] = v;
    }
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined) clean[k] = v;
    }
    return `/carteira?${new URLSearchParams(clean)}`;
  };
  const q = (p: Record<string, string | null | undefined>) => buildHref(p);
  const semCat = buildHref({ aba: null, cat: null });
  const semConta = buildHref({ aba: null, conta: null });
  const toggleHideTransfersHref = buildHref({ aba: null, semEntreContas: hideTransfers ? null : '1' });
  const toggleHideYieldsHref = buildHref({ aba: null, semRendimentos: hideYields ? null : '1' });
  const porCat = (id: string | null) => `${buildHref({ aba: null, cat: id ?? 'sem' })}#lista`;
  const back = buildHref({ aba: null });

  const mesTitulo = `${monthName(statementMonth, locale)} ${statementMonth.slice(0, 4)}`;
  const bancos = summary.accounts.filter((a) => a.type === 'BANK');
  const cartoes = summary.accounts.filter((a) => a.type === 'CREDIT');
  const contas = [...bancos, ...cartoes];

  const transfers = transactions.filter((tx) => tx.isInternalTransfer);
  const transferSum = transfers.reduce((s, tx) => s + Math.abs(tx.amountInCents), 0);
  const carameloInsight =
    transfers.length > 0
      ? t.wallet.carameloTransferInsight(transfers.length, money(transferSum))
      : summary.uncategorizedCount > 0
        ? t.wallet.carameloPendingInsight(summary.uncategorizedCount)
        : t.wallet.carameloAllCleanInsight;

  const activeCategoryLabel = cat
    ? (catInfo?.name ?? (cat === 'sem' ? tw.uncategorizedLabel : tw.categoryLabel))
    : t.wallet.allCategories;

  const tabs: { id: Aba; label: string; href: string }[] = [
    { id: 'extrato', label: t.planner.tabStatement, href: buildHref({ aba: null }) },
    { id: 'contas', label: t.planner.tabAccounts, href: buildHref({ aba: 'contas' }) },
    { id: 'planejar', label: t.planner.tabPlan, href: buildHref({ aba: 'planejar' }) },
  ];

  const connByAccountId = new Map<
    string,
    { displayName: string; lastSyncedAt: string | null; status: string; isImported: boolean; type: 'BANK' | 'CREDIT' }
  >();
  for (const conn of profile?.connections ?? []) {
    const isImported = conn.isImport;
    for (const acc of conn.accounts) {
      connByAccountId.set(acc.id, {
        displayName: conn.displayName,
        lastSyncedAt: conn.lastSyncedAt,
        status: conn.status,
        isImported,
        type: acc.type,
      });
    }
  }
  // "Conferir saldo" (T5.2): só conta manual ou importada (a ligada ao banco tem o saldo do banco).
  const reconcilable: ReconcileAccount[] = (profile?.connections ?? [])
    .filter((c) => c.isImport || c.isManual)
    .flatMap((c) =>
      c.accounts
        .filter((a) => !a.hidden)
        .map((a) => ({ id: a.id, name: a.name, type: a.type, balanceInCents: a.balanceInCents })),
    );

  const totalBankBalance = summary.balanceInCents ?? bancos.reduce((s, a) => s + a.balanceInCents, 0);
  const totalOpenBills = cartoes.reduce((s, a) => s + Math.max(0, -a.balanceInCents), 0);

  const rightRail = (
    <>
      {summary.byCategory.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>{t.wallet.byCategory}</Eyebrow>
            {cat && (
              <Link href={semCat} className="text-xs font-semibold text-laranja-texto no-underline hover:underline">
                {t.wallet.allCategories} ✕
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-3.5 rounded-card border border-linha bg-cartao p-5">
            {(() => {
              const topCats = summary.byCategory.slice(0, 6);
              const totalCat = summary.byCategory.reduce((s, c) => s + c.totalInCents, 0) || 1;
              return topCats.map((c, idx) => {
                const key = c.categoryId ?? 'sem';
                const isActive = cat === key;
                const highlight = cat ? isActive : idx === 0;
                const pct = Math.max(4, Math.round((c.totalInCents / totalCat) * 100));
                return (
                  <Link
                    key={key}
                    href={isActive ? semCat : porCat(c.categoryId)}
                    className="group flex flex-col gap-1.5 text-tinta no-underline"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span
                        className={`truncate font-bold group-hover:underline ${isActive ? 'text-laranja-texto' : ''}`}
                      >
                        {c.name}
                      </span>
                      <span className="shrink-0 text-tinta-suave tabular-nums">{money(c.totalInCents)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-papel-2">
                      <div
                        className={`bar-fill h-full rounded-full ${highlight ? 'bg-laranja' : 'bg-tinta'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                );
              });
            })()}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-[18px] bg-menta-clara py-3.5 pr-4 pl-2 text-tinta">
        <Mascot pose="caramelo-farejando" size={72} alt="Caramelo" />
        <p className="text-sm leading-5">{carameloInsight}</p>
      </div>
    </>
  );

  const editWalletLabel =
    locale === 'en' ? 'Edit my wallet' : locale === 'es' ? 'Editar mi cartera' : 'Editar minha carteira';

  return (
    <DesktopSplitShell rightWidth={340} right={rightRail}>
      {aba === 'extrato' ? (
        <ExtratoHeaderBar
          title={t.wallet.title}
          searchPlaceholder={t.walletExtra.search.placeholder}
          searchAriaLabel={t.walletExtra.search.ariaLabel}
          searchHidden={
            hideTransfers || hideYields
              ? {
                  ...(hideTransfers ? { semEntreContas: '1' } : {}),
                  ...(hideYields ? { semRendimentos: '1' } : {}),
                }
              : undefined
          }
          closeLabel={t.common.close}
          q={search}
          clearSearchLabel={t.growth.wallet.searchClear}
          searchHint={t.growth.wallet.searchHint}
          filterLabel={
            cat
              ? activeCategoryLabel
              : hideTransfers && hideYields
                ? `${tw.hideTransfers} · ${tw.hideYields}`
                : hideTransfers
                  ? tw.hideTransfers
                  : hideYields
                    ? tw.hideYields
                    : t.wallet.allCategories
          }
          filterActive={Boolean(cat) || Boolean(conta) || hideTransfers || hideYields}
          filterOptions={[
            { label: t.wallet.allCategories, href: semCat, active: !cat },
            ...summary.byCategory.map((c) => ({
              label: c.name,
              href: porCat(c.categoryId),
              active: cat === (c.categoryId ?? 'sem'),
              dotColor: c.categoryId ? c.color : 'var(--color-rosa-forte)',
            })),
            {
              label: tw.hideTransfers,
              href: toggleHideTransfersHref,
              active: hideTransfers,
              dividerBefore: true,
            },
            {
              label: tw.hideYields,
              href: toggleHideYieldsHref,
              active: hideYields,
            },
            // T4.4 · conta/cartão também no mobile (antes o filtro só existia no desktop).
            ...(contas.length > 0
              ? [
                  {
                    label: t.wallet.allAccounts,
                    href: semConta,
                    active: !conta,
                    dividerBefore: true,
                    groupLabel: t.growth.wallet.accountFilterLabel,
                  },
                  ...contas.map((a) => ({ label: a.name, href: q({ conta: a.name }), active: conta === a.name })),
                ]
              : []),
          ]}
          desktopControls={
            <div className="flex items-center gap-2 max-lg:hidden">
              <div className="inline-flex h-10 items-center gap-1 rounded-full bg-tinta px-1.5 text-sm font-semibold text-papel">
                <Link
                  href={q({ mes: shiftMonth(statementMonth, -1) })}
                  aria-label={tw.prevMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-papel/15"
                >
                  <Chevron d="M15 18l-6-6 6-6" />
                </Link>
                <span className="px-2 capitalize whitespace-nowrap">{mesTitulo}</span>
                <Link
                  href={q({ mes: shiftMonth(statementMonth, 1) })}
                  aria-label={statementMonth === hoje ? tw.simulateNextMonth : tw.nextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-papel/15"
                >
                  <Chevron d="M9 18l6-6-6-6" />
                </Link>
              </div>
              <FilterDropdown
                label={conta ?? t.wallet.allAccounts}
                active={Boolean(conta)}
                options={[
                  { label: t.wallet.allAccounts, href: semConta, active: !conta },
                  ...contas.map((a) => ({
                    label: a.name,
                    href: q({ conta: a.name }),
                    active: conta === a.name,
                  })),
                ]}
              />
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-hero lg:leading-[34px]">
            {t.wallet.title}
          </h1>
          {aba === 'contas' && (
            <Link
              href="/carteira/editar?voltar=/carteira?aba=contas"
              aria-label={editWalletLabel}
              title={editWalletLabel}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-linha bg-cartao px-3.5 text-sm font-semibold text-tinta no-underline transition-colors hover:bg-papel-2"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="max-sm:hidden">{editWalletLabel}</span>
            </Link>
          )}
        </div>
      )}

      {/* Abas superiores: Extrato | Contas | Planejar */}
      <nav
        aria-label={tw.sectionsAria}
        className="grid grid-cols-3 gap-1 rounded-full bg-papel-2 p-1 lg:w-fit lg:min-w-[360px]"
      >
        {tabs.map((tab) => {
          const active = aba === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold no-underline transition-colors ${
                active ? 'bg-tinta text-papel shadow-xs' : 'text-tinta-suave hover:text-tinta'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {aba === 'extrato' && (
        <>
          {/* Barra de filtros no desktop */}
          <div className="flex flex-wrap items-center justify-between gap-2 max-lg:hidden">
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_KEYS.map((f) => {
                const isSelected = !cat && filter === f;
                const pendingOutCount = summary.pendingExpensesCount ?? 0;
                const pendingInCount = summary.pendingIncomesCount ?? 0;
                const label =
                  f === 'pendentes'
                    ? tw.pendingChip(summary.uncategorizedCount)
                    : f === 'a-pagar' && pendingOutCount > 0
                      ? tw.pendingOutChip(pendingOutCount)
                      : f === 'a-receber' && pendingInCount > 0
                        ? tw.pendingInChip(pendingInCount)
                        : tw.filters[f];
                return (
                  <Link
                    key={f}
                    href={q({ filtro: f, cat: null })}
                    className={`rounded-full px-3.5 py-1.5 text-small font-semibold no-underline transition-colors ${
                      isSelected
                        ? 'bg-tinta text-papel'
                        : f === 'pendentes' && summary.uncategorizedCount > 0
                          ? 'bg-rosa text-tinta hover:opacity-85'
                          : (f === 'a-pagar' && pendingOutCount > 0) || (f === 'a-receber' && pendingInCount > 0)
                            ? 'bg-amarelo-claro text-tinta hover:opacity-85'
                            : 'bg-papel-2 text-tinta hover:bg-linha/60'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
              <Link
                href={toggleHideTransfersHref}
                aria-pressed={hideTransfers}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-small font-semibold no-underline transition-colors ${
                  hideTransfers ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta hover:bg-papel-2'
                }`}
              >
                <span>{tw.hideTransfers}</span>
                {hideTransfers && <span aria-hidden="true">✓</span>}
              </Link>
              <Link
                href={toggleHideYieldsHref}
                aria-pressed={hideYields}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-small font-semibold no-underline transition-colors ${
                  hideYields ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta hover:bg-papel-2'
                }`}
              >
                <span>{tw.hideYields}</span>
                {hideYields && <span aria-hidden="true">✓</span>}
              </Link>
            </div>
            {(cat || conta) && (
              <div className="flex flex-wrap items-center gap-2">
                {cat && (
                  <Link
                    href={semCat}
                    aria-label={tw.clearCategoryFilter}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-linha bg-cartao px-3 text-xs font-semibold text-tinta no-underline hover:bg-papel-2"
                  >
                    <i
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: catInfo?.categoryId ? catInfo.color : 'var(--color-rosa-forte)' }}
                      aria-hidden="true"
                    />
                    <span>{activeCategoryLabel}</span>
                    <span className="text-tinta-suave">✕</span>
                  </Link>
                )}
                {conta && (
                  <Link
                    href={semConta}
                    aria-label={tw.clearAccountFilter}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-linha bg-cartao px-3 text-xs font-semibold text-tinta no-underline hover:bg-papel-2"
                  >
                    <span>{conta}</span>
                    <span className="text-tinta-suave">✕</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Seletor de mês + resumo compacto no mobile (< lg) */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex items-center justify-between rounded-full bg-papel-2 p-1">
              <Link
                href={q({ mes: shiftMonth(statementMonth, -1) })}
                aria-label={tw.prevMonth}
                className="flex h-9 w-9 items-center justify-center"
              >
                <Chevron d="M15 18l-6-6 6-6" />
              </Link>
              <span className="text-body font-bold capitalize">{mesTitulo}</span>
              <Link
                href={q({ mes: shiftMonth(statementMonth, 1) })}
                aria-label={statementMonth === hoje ? tw.simulateNextMonth : tw.nextMonth}
                className="flex h-9 w-9 items-center justify-center"
              >
                <Chevron d="M9 18l6-6-6-6" />
              </Link>
            </div>

            {(summary.outcomeInCents > 0 || summary.incomeInCents > 0) && (
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href={buildHref({ filtro: 'saidas', cat: null }) + '#lista'}
                  className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 rounded-2xl border border-linha bg-cartao px-3.5 py-2.5 text-tinta no-underline"
                >
                  <span className="text-xs font-semibold text-tinta-suave">{tw.filters.saidas}</span>
                  <span className="text-body font-bold tabular-nums">{money(summary.outcomeInCents)}</span>
                </Link>
                <Link
                  href={buildHref({ filtro: 'entradas', cat: null }) + '#lista'}
                  className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 rounded-2xl border border-linha bg-cartao px-3.5 py-2.5 text-tinta no-underline"
                >
                  <span className="text-xs font-semibold text-tinta-suave">{tw.filters.entradas}</span>
                  <span className="text-body font-bold text-verde-texto tabular-nums">
                    + {money(summary.incomeInCents)}
                  </span>
                </Link>
              </div>
            )}
          </div>

          {conta && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-papel-2 py-2 pr-1.5 pl-3 lg:hidden">
              <span className="truncate text-small font-semibold text-tinta">{tw.accountPrefix(conta)}</span>
              <Link
                href={semConta}
                aria-label={tw.clearAccountFilter}
                className="flex h-9 shrink-0 items-center rounded-full bg-cartao px-3 text-small font-semibold text-tinta no-underline"
              >
                {t.wallet.allAccounts} ✕
              </Link>
            </div>
          )}

          <div id="lista" className="scroll-mt-4 flex flex-col gap-5 pb-20 lg:pb-0">
            {categorizeMode && (
              <CategorizeQueue
                pending={transactions
                  .filter((tx) => !tx.categoryId && !tx.isInternalTransfer && tx.amountInCents !== 0)
                  .slice(0, 100)
                  .map((tx) => ({
                    id: tx.id,
                    description: tx.description,
                    customDescription: tx.customDescription,
                    amountInCents: tx.amountInCents,
                    occurredAt: tx.occurredAt,
                  }))}
                categories={categoriesData?.categories ?? []}
                exitHref={buildHref({ modo: null })}
                locale={locale}
              />
            )}
            {!categorizeMode && !cat && summary.uncategorizedCount > 0 && (
              <Link
                href={q({ filtro: 'pendentes', modo: 'categorizar' })}
                className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rosa px-4 text-[14px] font-bold text-tinta no-underline"
              >
                {t.growth.wallet.categorizeMode} ({summary.uncategorizedCount}) ›
              </Link>
            )}
            {cat ? (
              <div className="flex items-center gap-2 rounded-2xl bg-papel-2 py-2.5 pr-2 pl-3.5 lg:hidden">
                <i
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: catInfo?.categoryId ? catInfo.color : 'var(--color-rosa-forte)' }}
                />
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-body font-bold">
                    {catInfo?.name ?? (cat === 'sem' ? tw.uncategorizedLabel : tw.categoryLabel)}
                  </span>
                  <span className="text-small leading-[18px] text-tinta-suave">
                    {tw.categoryEntriesSummary(
                      money(catInfo?.totalInCents ?? 0),
                      shown.length,
                      monthName(statementMonth, locale),
                    )}
                  </span>
                </span>
                <Link
                  href={semCat}
                  aria-label={tw.clearCategoryFilter}
                  className="flex h-9 shrink-0 items-center rounded-full bg-cartao px-3 text-small font-semibold text-tinta no-underline"
                >
                  {tw.viewAll} ✕
                </Link>
              </div>
            ) : (
              <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-10 md:px-10 lg:hidden">
                {FILTER_KEYS.map((f) => {
                  const pendingOutCount = summary.pendingExpensesCount ?? 0;
                  const pendingInCount = summary.pendingIncomesCount ?? 0;
                  const label =
                    f === 'pendentes'
                      ? tw.pendingChip(summary.uncategorizedCount)
                      : f === 'a-pagar' && pendingOutCount > 0
                        ? tw.pendingOutChip(pendingOutCount)
                        : f === 'a-receber' && pendingInCount > 0
                          ? tw.pendingInChip(pendingInCount)
                          : tw.filters[f];
                  return (
                    <Link
                      key={f}
                      href={q({ filtro: f })}
                      className={`shrink-0 rounded-full px-3.5 py-2 text-small font-semibold no-underline ${
                        filter === f
                          ? 'bg-tinta text-papel'
                          : f === 'pendentes' && summary.uncategorizedCount > 0
                            ? 'bg-rosa text-tinta'
                            : (f === 'a-pagar' && pendingOutCount > 0) || (f === 'a-receber' && pendingInCount > 0)
                              ? 'bg-amarelo-claro text-tinta'
                              : 'bg-papel-2 text-tinta'
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
                <Link
                  href={toggleHideTransfersHref}
                  aria-pressed={hideTransfers}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-small font-semibold no-underline ${
                    hideTransfers ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta'
                  }`}
                >
                  <span>{tw.hideTransfers}</span>
                  {hideTransfers && <span aria-hidden="true">✓</span>}
                </Link>
                <Link
                  href={toggleHideYieldsHref}
                  aria-pressed={hideYields}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-small font-semibold no-underline ${
                    hideYields ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta'
                  }`}
                >
                  <span>{tw.hideYields}</span>
                  {hideYields && <span aria-hidden="true">✓</span>}
                </Link>
              </div>
            )}

            {!cat && filter === 'pendentes' && shown.some((tx) => tx.amountInCents !== 0) && (
              <AutoCategorizeButton t={t.walletExtra.autoCategorize} />
            )}

            {shown.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Mascot
                  pose={filter === 'pendentes' && !cat && !conta ? 'caramelo-feliz' : 'dormindo'}
                  size={140}
                  alt=""
                />
                <p className="text-body text-tinta-suave">
                  {filter === 'pendentes' && !cat && !conta
                    ? tw.allCategorizedNote
                    : tw.nothingInMonth(monthName(statementMonth, locale))}
                </p>
                {transactions.length === 0 && (
                  <ButtonLink href="/conectar?voltar=/carteira" variant="outline">
                    {tw.connectBankCta}
                  </ButtonLink>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-6 lg:hidden">
                  {[...groups.entries()].map(([day, list]) => (
                    <section key={day} className="flex flex-col gap-1">
                      <h2 className="pb-1 text-body leading-5 font-bold text-tinta">{day}</h2>
                      <div className="flex flex-col">
                        {list.map((tx) => (
                          <Row key={tx.id} t={tx} back={back} locale={locale} labels={t.walletExtra.txRow} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="overflow-hidden rounded-card border border-linha bg-cartao px-4 py-2 max-lg:hidden xl:px-5">
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed border-collapse">
                      <thead>
                        <tr className="border-b border-linha text-left">
                          <th className="w-[54px] px-2 py-3.5 text-xs font-semibold text-tinta-suave xl:w-[64px] xl:px-3">
                            {t.wallet.tableHeaders.date}
                          </th>
                          <th className="w-auto px-2 py-3.5 text-xs font-semibold text-tinta-suave xl:px-3">
                            {t.wallet.tableHeaders.description}
                          </th>
                          <th className="w-[128px] px-2 py-3.5 text-xs font-semibold text-tinta-suave xl:w-[156px] xl:px-3">
                            {t.wallet.tableHeaders.category}
                          </th>
                          <th className="w-[132px] px-3 py-3.5 text-xs font-semibold text-tinta-suave max-xl:hidden">
                            {t.wallet.tableHeaders.account}
                          </th>
                          <th className="w-[96px] px-2 py-3.5 text-right text-xs font-semibold text-tinta-suave xl:w-[120px] xl:px-3">
                            {t.wallet.tableHeaders.amount}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((tx) => {
                          const pending = !tx.categoryId && !tx.isInternalTransfer;
                          const href = `/carteira/${tx.id}?voltar=${encodeURIComponent(back)}`;
                          return (
                            <tr
                              key={tx.id}
                              className="border-b border-linha transition-colors last:border-b-0 hover:bg-papel-2/40"
                            >
                              <td className="px-2 py-4 text-small whitespace-nowrap text-tinta-suave xl:px-3">
                                {shortDate(tx.occurredAt, locale)}
                              </td>
                              <td className="min-w-0 px-2 py-4 xl:px-3">
                                <Link
                                  href={href}
                                  className="block truncate text-body font-semibold text-tinta no-underline hover:underline"
                                >
                                  {tx.customDescription || tx.description}
                                </Link>
                                <span className="block truncate text-xs text-tinta-suave xl:hidden">
                                  {tx.accountName ?? tw.manualLabel}
                                </span>
                              </td>
                              <td className="min-w-0 px-2 py-4 xl:px-3">
                                {pending ? (
                                  <Link
                                    href={href}
                                    className="inline-flex h-7 max-w-full items-center truncate rounded-full bg-amarelo-claro px-2.5 text-small font-semibold text-tinta no-underline hover:opacity-85"
                                  >
                                    {t.wallet.categorizeBadge}
                                  </Link>
                                ) : tx.isInternalTransfer ? (
                                  <Link
                                    href={href}
                                    className="inline-flex h-7 max-w-full items-center truncate rounded-full bg-papel-2 px-2.5 text-small font-semibold text-tinta-suave no-underline hover:opacity-85"
                                  >
                                    {t.wallet.internalTransferBadge}
                                  </Link>
                                ) : (
                                  <Link
                                    href={href}
                                    className="flex min-w-0 items-center gap-1.5 text-sm text-tinta no-underline hover:underline"
                                  >
                                    <i
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{ background: tx.categoryColor ?? 'var(--color-linha)' }}
                                      aria-hidden="true"
                                    />
                                    <span className="truncate">
                                      {tx.categoryName ?? (tx.personId ? tw.splitLabel : '—')}
                                    </span>
                                  </Link>
                                )}
                              </td>
                              <td className="truncate px-3 py-4 text-small text-tinta-suave max-xl:hidden">
                                {tx.accountName ?? tw.manualLabel}
                              </td>
                              <td
                                className={`px-2 py-4 text-right text-[14px] font-bold whitespace-nowrap tabular-nums xl:px-3 xl:text-body ${
                                  tx.isInternalTransfer
                                    ? 'text-tinta-suave line-through'
                                    : tx.amountInCents > 0
                                      ? 'text-verde-texto'
                                      : 'text-tinta'
                                }`}
                              >
                                {!tx.isInternalTransfer && tx.amountInCents > 0 ? '+ ' : ''}
                                {money(Math.abs(tx.amountInCents))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {aba === 'contas' && (
        <section className="flex flex-col gap-6 pb-8">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 rounded-card bg-menta-clara p-5 text-tinta">
              <Eyebrow>{tw.accountsBalanceLabel}</Eyebrow>
              <span className="font-display text-hero leading-8 font-extrabold tabular-nums">
                {money(totalBankBalance)}
              </span>
              <span className="text-small text-tinta-suave">{tw.visibleAccounts(bancos.length)}</span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-card border border-bronze-borda bg-bronze-suave p-5 text-tinta">
              <Eyebrow>{tw.openBillsLabel}</Eyebrow>
              <span className="font-display text-hero leading-8 font-extrabold tabular-nums">
                {money(totalOpenBills)}
              </span>
              <span className="text-small text-tinta-suave">{tw.visibleCards(cartoes.length)}</span>
            </div>
          </div>

          {bancos.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <Eyebrow>{tw.bankAccountsHeading}</Eyebrow>
                <span className="text-sm font-bold text-tinta tabular-nums">{money(totalBankBalance)}</span>
              </div>
              <div className="flex flex-col divide-y divide-linha rounded-card border border-linha bg-cartao px-4">
                {bancos.map((a) => {
                  const conn = connByAccountId.get(a.id);
                  const syncText = conn
                    ? conn.isImported
                      ? tw.importedStatement
                      : conn.status === 'ERROR'
                        ? tw.stoppedUpdating
                        : conn.lastSyncedAt
                          ? updatedTimeLabel(conn.lastSyncedAt, locale)
                          : tw.connectedStatus
                    : tw.manualAccount;
                  return (
                    <Link
                      key={a.id}
                      href={`/carteira/conta/${a.id}?mes=${statementMonth}`}
                      className="flex min-h-[70px] items-center gap-3.5 py-3.5 text-tinta no-underline transition-colors hover:text-laranja-texto"
                    >
                      <BankBadge nome={a.name} instituicao={conn?.displayName} size={38} quadrado logos={logos} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-body font-semibold">{a.name}</span>
                        <span
                          className={`truncate text-xs ${
                            conn?.status === 'ERROR' && !conn.isImported
                              ? 'font-semibold text-vermelho-texto'
                              : 'text-tinta-suave'
                          }`}
                        >
                          {conn?.displayName && conn.displayName !== a.name ? `${conn.displayName} · ` : ''}
                          {syncText}
                        </span>
                      </div>
                      <span className="shrink-0 font-display text-[17px] font-extrabold tabular-nums">
                        {money(a.balanceInCents)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {cartoes.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <Eyebrow>{tw.creditCardsHeading}</Eyebrow>
                <span className="text-sm font-bold text-tinta tabular-nums">{money(totalOpenBills)}</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {cartoes.map((a) => {
                  const conn = connByAccountId.get(a.id);
                  const fatura = Math.max(0, -a.balanceInCents);
                  return (
                    <Link
                      key={a.id}
                      href={`/carteira/conta/${a.id}?mes=${statementMonth}`}
                      className="flex min-w-0 flex-col gap-3.5 rounded-card border border-linha bg-cartao p-5 text-tinta no-underline transition-colors hover:bg-papel-2/50"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <BankBadge nome={a.name} instituicao={conn?.displayName} size={36} quadrado logos={logos} />
                          <span className="truncate text-body font-bold">{a.name}</span>
                        </div>
                        <CardNetworkBadge brand={a.brand} last4={a.last4} className="shrink-0" />
                      </div>

                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-tinta-suave">{tw.currentBill}</span>
                          <span className="font-display text-2xl leading-7 font-extrabold tabular-nums">
                            {money(fatura)}
                          </span>
                        </div>
                        {a.dueDate && (
                          <span className="shrink-0 rounded-full bg-papel-2 px-3 py-1 text-xs font-semibold text-tinta-suave">
                            {tw.dueOn(shortDate(a.dueDate, locale))}
                          </span>
                        )}
                      </div>

                      {a.creditLimitInCents ? (
                        <BudgetProgressBar usado={fatura} limite={a.creditLimitInCents} locale={locale} />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {bancos.length === 0 && cartoes.length === 0 && summary.hiddenAccounts.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-card border border-linha bg-cartao py-8 text-center">
              <Mascot pose="conectando" size={120} alt="" />
              <p className="max-w-[320px] text-body text-tinta-suave">{tw.noAccountsEmpty}</p>
            </div>
          )}

          {reconcilable.length > 0 && <ReconcileBalanceCard accounts={reconcilable} />}

          <div className="flex justify-center pt-1">
            <Link
              href="/carteira/editar?voltar=/carteira?aba=contas"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-linha bg-cartao px-5 text-sm font-semibold text-tinta no-underline transition-colors hover:bg-papel-2"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              {editWalletLabel}
            </Link>
          </div>
        </section>
      )}

      {aba === 'planejar' && (
        <PlannerHub
          plan={plannerData?.[0]?.plan ?? null}
          forecast={plannerData?.[1] ?? null}
          budgets={plannerData?.[2]?.budgets ?? []}
          subscriptions={plannerData?.[3] ?? null}
          people={plannerData?.[4] ?? null}
          summary={summary}
          month={statementMonth}
          locale={locale}
          t={t}
        />
      )}

      <QuickAddButton variant="fab" label={t.nav.addExpense} locale={locale} />
    </DesktopSplitShell>
  );
}
