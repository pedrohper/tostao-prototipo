'use client';

import Link from 'next/link';
import { money } from '@/lib/format';
import { MASKED, useHiddenBalance } from './balance-card';

export interface PendingAlertsCardProps {
  month: string;
  title: string;
  pendingExpensesLabel: string;
  pendingIncomesLabel: string;
  pendingExpensesCount: number;
  pendingExpensesInCents: number;
  pendingIncomesCount: number;
  pendingIncomesInCents: number;
}

/**
 * Cards lado a lado de Pendências e alertas (Despesas a pagar / Receitas a receber),
 * levando direto para a lista filtrada na Carteira para dar baixa ("Paguei" / "Recebi").
 */
export function PendingAlertsCard({
  month,
  title,
  pendingExpensesLabel,
  pendingIncomesLabel,
  pendingExpensesCount,
  pendingExpensesInCents,
  pendingIncomesCount,
  pendingIncomesInCents,
}: PendingAlertsCardProps) {
  const hidden = useHiddenBalance();
  const base = month ? `/carteira?mes=${encodeURIComponent(month)}&` : '/carteira?';

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-lg leading-6 font-extrabold text-tinta">{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`${base}filtro=a-pagar#lista`}
          className="flex min-w-0 flex-col gap-2.5 rounded-[20px] border border-linha bg-cartao p-4 text-tinta no-underline transition-colors hover:bg-papel-2/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-tinta-suave" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </span>
            <span
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ${
                pendingExpensesCount > 0 ? 'bg-alerta text-papel-fixo' : 'bg-papel-2 text-tinta-suave'
              }`}
            >
              {pendingExpensesCount > 0 ? `+${pendingExpensesCount}` : '0'}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px] font-medium text-tinta-suave">{pendingExpensesLabel}</span>
            <span className="font-display text-[19px] leading-6 font-extrabold text-vermelho-texto tabular-nums">
              {hidden ? `R$ ${MASKED}` : money(pendingExpensesInCents)}
            </span>
          </div>
        </Link>

        <Link
          href={`${base}filtro=a-receber#lista`}
          className="flex min-w-0 flex-col gap-2.5 rounded-[20px] border border-linha bg-cartao p-4 text-tinta no-underline transition-colors hover:bg-papel-2/50"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-tinta-suave" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </span>
            <span
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums ${
                pendingIncomesCount > 0 ? 'bg-menta text-tinta-fixa' : 'bg-papel-2 text-tinta-suave'
              }`}
            >
              {pendingIncomesCount > 0 ? `+${pendingIncomesCount}` : '0'}
            </span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px] font-medium text-tinta-suave">{pendingIncomesLabel}</span>
            <span className="font-display text-[19px] leading-6 font-extrabold text-verde-texto tabular-nums">
              {hidden ? `R$ ${MASKED}` : money(pendingIncomesInCents)}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
