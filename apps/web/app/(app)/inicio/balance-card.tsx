'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { money } from '@/lib/format';

const HIDE_BALANCE_KEY = 'tostao-hide-balance';
const listeners = new Set<() => void>();

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_BALANCE_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeHidden(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HIDE_BALANCE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function toggleHiddenBalance() {
  const next = !readHidden();
  try {
    localStorage.setItem(HIDE_BALANCE_KEY, next ? '1' : '0');
  } catch {
    // ignore storage quota/private mode errors
  }
  listeners.forEach((fn) => fn());
}

function useHiddenBalance() {
  return useSyncExternalStore(subscribeHidden, readHidden, () => false);
}

function EyeButton({
  hidden,
  onToggle,
  hideLabel,
  showLabel,
  className = '',
}: {
  hidden: boolean;
  onToggle: () => void;
  hideLabel: string;
  showLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={hidden}
      aria-label={hidden ? showLabel : hideLabel}
      title={hidden ? showLabel : hideLabel}
      className={`relative z-[2] flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-tinta-suave transition-colors hover:bg-papel-2 hover:text-tinta after:absolute after:-inset-1 after:content-[''] ${className}`}
    >
      {hidden ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <path d="M1 1l22 22" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

function FlowArrow({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === 'up' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
    </svg>
  );
}

const MASKED = '•••••';

export interface BalanceCardProps {
  month?: string;
  balanceInCents: number | null;
  incomeInCents: number;
  outcomeInCents: number;
  outcomePct: number | null;
  walletLabel: string;
  balanceLabel: string;
  balanceLabelDesktop: string;
  noConnectedBankHint: string;
  incomeLabel: string;
  incomeLabelDesktop: string;
  outcomeLabel: string;
  outcomeLabelDesktop: string;
  percentOfIncomeLabel: string | null;
  hideBalanceAria: string;
  showBalanceAria: string;
  accountsPreview: { name: string; balanceInCents: number }[];
  /** "Gastos +12% vs mês anterior" (ou "Já gastou 64% do que gastou em outubro" no mês corrente). null = sem base. */
  changeLabel?: string | null;
  /** "Faturas abertas: R$ 1.200,00" (soma dos cartões). null = sem fatura. */
  openBillsLabel?: string | null;
  /** Sem conta conectada: botão direto pra /conectar no lugar do texto cinza. */
  connectCta?: { label: string; href: string } | null;
}

/** Linha de contexto sob os números: variação do mês e faturas abertas. */
function ContextLine({ changeLabel, openBillsLabel }: Pick<BalanceCardProps, 'changeLabel' | 'openBillsLabel'>) {
  if (!changeLabel && !openBillsLabel) return null;
  return (
    <div className="relative z-[1] flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] font-semibold text-tinta-suave tabular-nums">
      {changeLabel && <span>{changeLabel}</span>}
      {openBillsLabel && (
        <Link href="/carteira?aba=contas" className="text-tinta-suave no-underline hover:text-tinta">
          {openBillsLabel}
        </Link>
      )}
    </div>
  );
}

function ConnectCta({
  cta,
  centered = false,
  className = '',
}: {
  cta: { label: string; href: string };
  centered?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={cta.href}
      className={`relative z-[2] inline-flex min-h-11 items-center ${centered ? 'self-center' : 'self-start'} rounded-full bg-laranja px-4 text-[14px] font-semibold text-tinta-fixa no-underline ${className}`}
    >
      {cta.label}
    </Link>
  );
}

function buildWalletHref(month: string | undefined, filtro?: 'entradas' | 'saidas') {
  const params = new URLSearchParams();
  if (month) params.set('mes', month);
  if (filtro) params.set('filtro', filtro);
  const qs = params.toString();
  const base = qs ? `/carteira?${qs}` : '/carteira';
  return filtro ? `${base}#lista` : base;
}

export function MobileBalanceCard({
  month,
  balanceInCents,
  incomeInCents,
  outcomeInCents,
  walletLabel,
  balanceLabel,
  noConnectedBankHint,
  incomeLabel,
  outcomeLabel,
  hideBalanceAria,
  showBalanceAria,
  changeLabel,
  openBillsLabel,
  connectCta,
}: BalanceCardProps) {
  const hidden = useHiddenBalance();
  const walletHref = buildWalletHref(month);
  const incomeHref = buildWalletHref(month, 'entradas');
  const outcomeHref = buildWalletHref(month, 'saidas');

  return (
    <div className="relative flex flex-col gap-3.5 rounded-[22px] border border-linha bg-cartao p-[18px]">
      <Link href={walletHref} aria-label={walletLabel} className="absolute inset-0 rounded-[22px]" />
      <div className="relative flex flex-col items-center gap-2 text-center">
        {balanceInCents !== null ? (
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <span className="text-[13px] font-semibold text-tinta-suave">{balanceLabel}</span>
            <div className="flex items-center justify-center gap-1.5">
              <span className="font-display text-[40px] leading-[44px] font-extrabold tracking-[-0.5px] tabular-nums">
                {hidden ? `R$ ${MASKED}` : money(balanceInCents)}
              </span>
              <EyeButton
                hidden={hidden}
                onToggle={toggleHiddenBalance}
                hideLabel={hideBalanceAria}
                showLabel={showBalanceAria}
              />
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[13px] font-semibold text-tinta-suave">{noConnectedBankHint}</span>
              <EyeButton
                hidden={hidden}
                onToggle={toggleHiddenBalance}
                hideLabel={hideBalanceAria}
                showLabel={showBalanceAria}
              />
            </div>
            {connectCta && <ConnectCta cta={connectCta} centered />}
          </div>
        )}
      </div>

      <div className="relative z-[1] grid grid-cols-2 gap-2.5 border-t border-linha pt-3.5">
        <Link href={incomeHref} className="flex min-w-0 items-center gap-2.5 text-tinta no-underline">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-menta-clara text-verde-texto"
          >
            <FlowArrow direction="up" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold text-tinta-suave">{incomeLabel}</span>
            <span className="text-[15px] font-bold text-verde-texto tabular-nums sm:text-[17px]">
              {hidden ? `R$ ${MASKED}` : money(incomeInCents)}
            </span>
          </span>
        </Link>
        <Link href={outcomeHref} className="flex min-w-0 items-center gap-2.5 text-tinta no-underline">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rosa text-vermelho-texto"
          >
            <FlowArrow direction="down" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold text-tinta-suave">{outcomeLabel}</span>
            <span className="text-[15px] font-bold text-vermelho-texto tabular-nums sm:text-[17px]">
              {hidden ? `R$ ${MASKED}` : money(outcomeInCents)}
            </span>
          </span>
        </Link>
      </div>
      <ContextLine changeLabel={changeLabel} openBillsLabel={openBillsLabel} />
    </div>
  );
}

export function DesktopBalanceRow({
  month,
  balanceInCents,
  incomeInCents,
  outcomeInCents,
  walletLabel,
  balanceLabelDesktop,
  noConnectedBankHint,
  incomeLabelDesktop,
  outcomeLabelDesktop,
  percentOfIncomeLabel,
  hideBalanceAria,
  showBalanceAria,
  accountsPreview,
  changeLabel,
  openBillsLabel,
  connectCta,
}: BalanceCardProps) {
  const hidden = useHiddenBalance();
  const walletHref = buildWalletHref(month);
  const incomeHref = buildWalletHref(month, 'entradas');
  const outcomeHref = buildWalletHref(month, 'saidas');

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-[1.25fr_1fr_1fr] xl:gap-5">
      <div className="relative col-span-2 flex min-w-0 flex-col gap-1 rounded-[22px] border border-linha bg-cartao p-[22px] text-tinta xl:col-span-1">
        <Link href={walletHref} aria-label={walletLabel} className="absolute inset-0 rounded-[22px]" />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-tinta-suave">{balanceLabelDesktop}</span>
          <EyeButton
            hidden={hidden}
            onToggle={toggleHiddenBalance}
            hideLabel={hideBalanceAria}
            showLabel={showBalanceAria}
            className="-mt-1.5 -mr-1.5"
          />
        </div>
        <span className="font-display text-[32px] leading-[36px] font-extrabold tracking-[-0.5px] tabular-nums xl:text-[36px] xl:leading-[40px] min-[1400px]:text-[46px] min-[1400px]:leading-[50px]">
          {balanceInCents !== null ? (hidden ? `R$ ${MASKED}` : money(balanceInCents)) : '—'}
        </span>
        {accountsPreview.length > 0 ? (
          <span className="text-[13px] leading-[18px] text-tinta-suave">
            {accountsPreview.map((a) => `${a.name} ${hidden ? `R$ ${MASKED}` : money(a.balanceInCents)}`).join(' · ')}
          </span>
        ) : balanceInCents === null ? (
          <span className="flex flex-col gap-2 text-[13px] leading-[18px] text-tinta-suave">
            {noConnectedBankHint}
            {connectCta && <ConnectCta cta={connectCta} />}
          </span>
        ) : null}
        <ContextLine changeLabel={changeLabel} openBillsLabel={openBillsLabel} />
      </div>

      <Link
        href={incomeHref}
        className="flex min-w-0 flex-col gap-1 rounded-[22px] border border-linha bg-cartao p-[22px] text-tinta no-underline"
      >
        <span className="text-sm font-semibold text-tinta-suave">{incomeLabelDesktop}</span>
        <span className="font-display text-[22px] leading-[28px] font-extrabold whitespace-nowrap text-verde-texto tabular-nums xl:text-[24px] xl:leading-[32px] min-[1400px]:text-[30px] min-[1400px]:leading-[38px]">
          {hidden ? `R$ ${MASKED}` : `+ ${money(incomeInCents)}`}
        </span>
      </Link>

      <Link
        href={outcomeHref}
        className="flex min-w-0 flex-col gap-1 rounded-[22px] border border-linha bg-cartao p-[22px] text-tinta no-underline"
      >
        <span className="text-sm font-semibold text-tinta-suave">{outcomeLabelDesktop}</span>
        <span className="font-display text-[22px] leading-[28px] font-extrabold whitespace-nowrap tabular-nums xl:text-[24px] xl:leading-[32px] min-[1400px]:text-[30px] min-[1400px]:leading-[38px]">
          {hidden ? `R$ ${MASKED}` : money(outcomeInCents)}
        </span>
        {percentOfIncomeLabel && !hidden && (
          <span className="text-[13px] text-tinta-suave">{percentOfIncomeLabel}</span>
        )}
      </Link>
    </div>
  );
}
