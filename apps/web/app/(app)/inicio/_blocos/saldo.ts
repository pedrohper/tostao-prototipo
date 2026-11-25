// O que o cartão de saldo mostra, calculado a partir do resumo do mês.
import type { MonthSummaryResponse } from '@tostao/contracts';
import { money, monthName } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n';
import type { BalanceCardProps } from '../balance-card';

export function balanceCardProps({
  summary,
  month,
  isPastMonth,
  locale,
  t,
}: {
  summary: MonthSummaryResponse;
  month: string;
  isPastMonth: boolean;
  locale: Locale;
  t: Dictionary;
}): BalanceCardProps {
  const bankAccounts = summary.accounts.filter((a) => a.type === 'BANK');
  const creditCards = summary.accounts.filter((a) => a.type === 'CREDIT');
  const outcomePct =
    summary.incomeInCents > 0 ? Math.round((summary.outcomeInCents / summary.incomeInCents) * 100) : null;
  const balanceLabel = isPastMonth
    ? t.home.balanceAtEndOfMonth(monthName(month, locale))
    : t.home.balanceInAccounts(bankAccounts.length);
  // Cartão: saldo negativo = fatura em aberto.
  const openBillsInCents = creditCards.reduce((sum, c) => sum + Math.max(0, -c.balanceInCents), 0);
  const noAccounts = bankAccounts.length === 0 && creditCards.length === 0;

  return {
    month,
    balanceInCents: summary.balanceInCents,
    incomeInCents: summary.incomeInCents,
    outcomeInCents: summary.outcomeInCents,
    outcomePct,
    walletLabel: t.nav.wallet,
    balanceLabel,
    balanceLabelDesktop: balanceLabel.replace(/\s*›$/, ''),
    noConnectedBankHint: t.home.noConnectedBankHint,
    incomeLabel: t.home.incomeLabel,
    incomeLabelDesktop: t.home.incomeLabel,
    outcomeLabel: t.home.outcomeLabel,
    outcomeLabelDesktop: t.home.outcomeLabel,
    percentOfIncomeLabel: outcomePct !== null ? t.home.percentOfIncome(outcomePct) : null,
    hideBalanceAria: t.home.hideBalanceAria,
    showBalanceAria: t.home.showBalanceAria,
    accountsPreview: bankAccounts.slice(0, 3).map((a) => ({ name: a.name, balanceInCents: a.balanceInCents })),
    openBillsLabel: openBillsInCents > 0 ? t.growth.home.openBills(money(openBillsInCents)) : null,
    openBillsInCents: openBillsInCents > 0 ? openBillsInCents : null,
    openBillsShortLabel: t.walletExtra.main.openBillsLabel,
    connectCta: noAccounts ? { label: t.growth.home.connectCta, href: '/conectar?voltar=/inicio' } : null,
  };
}
