// Seletor de mês do topo da Home. Um só: no celular fica claro (bg-papel-2), no computador escuro (bg-tinta).
import Link from 'next/link';
import { monthName, shiftMonth } from '@/lib/format';
import type { Dictionary, Locale } from '@/lib/i18n';

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

const chevronLink =
  'flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-linha/60 lg:hover:bg-papel/15';

export function MonthSelector({
  month,
  currentMonth,
  locale,
  t,
}: {
  month: string;
  currentMonth: string;
  locale: Locale;
  t: Dictionary;
}) {
  const name = monthName(month, locale);
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const label = month.slice(0, 4) === currentMonth.slice(0, 4) ? capitalized : `${capitalized} ${month.slice(0, 4)}`;
  const next = shiftMonth(month, 1);
  return (
    <div className="inline-flex h-10 items-center gap-0.5 rounded-full bg-papel-2 px-1 text-sm font-bold text-tinta lg:gap-1 lg:bg-tinta lg:px-1.5 lg:font-semibold lg:text-papel">
      <Link
        href={`/inicio?mes=${shiftMonth(month, -1)}`}
        aria-label={t.walletExtra.main.prevMonth}
        className={chevronLink}
      >
        <MonthChevron d="M15 18l-6-6 6-6" />
      </Link>
      <span className="px-2 whitespace-nowrap">{label}</span>
      {month < currentMonth ? (
        <Link
          href={next === currentMonth ? '/inicio' : `/inicio?mes=${next}`}
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
}
