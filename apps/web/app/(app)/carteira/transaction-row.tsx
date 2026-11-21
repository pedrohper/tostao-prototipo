'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { CatIcon, Icon } from '@/components/icone';
import Link from 'next/link';
import type { TransactionDTO } from '@tostao/contracts';
import { money, shortDate } from '@/lib/format';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n';

/** Barra de busca da Carteira. Formulário comum (GET), funciona até sem JavaScript. */
export function SearchBar({
  q = '',
  autoFocus = false,
  hidden = {},
  placeholder = 'Buscar loja, pessoa, categoria…',
  ariaLabel = 'Buscar transações',
  className = '',
}: {
  q?: string;
  autoFocus?: boolean;
  hidden?: Record<string, string>;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <form
      action="/carteira/busca"
      role="search"
      className={`flex h-11 items-center gap-2 rounded-full border border-linha bg-cartao px-3.5 transition-colors focus-within:border-tinta sm:px-4 ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="shrink-0 text-tinta-suave"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        name="q"
        type="search"
        defaultValue={q}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-tinta outline-none placeholder:text-tinta-suave"
      />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </form>
  );
}

export function Chevron({ d, className = '' }: { d: string; className?: string }) {
  return (
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
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

export type FilterDropdownOption = {
  label: string;
  href: string;
  active?: boolean;
  dotColor?: string | null;
  dividerBefore?: boolean;
};

/** Pill dropdown para filtros da Carteira, mantendo links reais de navegação. */
export function FilterDropdown({
  label,
  active = false,
  options,
  iconOnly = false,
}: {
  label: string;
  active?: boolean;
  options: FilterDropdownOption[];
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        title={label}
        className={
          iconOnly
            ? `relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                active ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta hover:bg-papel-2'
              }`
            : `inline-flex h-11 max-w-[44vw] items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors sm:max-w-[220px] sm:px-4 sm:text-sm ${
                active ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta hover:bg-papel-2'
              }`
        }
      >
        {iconOnly ? (
          <>
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
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {active && (
              <span
                className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-laranja ring-2 ring-papel"
                aria-hidden="true"
              />
            )}
          </>
        ) : (
          <>
            <span className="truncate">{label}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 max-h-[320px] w-max min-w-[220px] max-w-[min(280px,calc(100vw-2.5rem))] overflow-y-auto rounded-2xl border border-linha bg-cartao p-1.5 shadow-xl"
        >
          {options.map((opt) => (
            <Fragment key={`${opt.href}-${opt.label}`}>
              {opt.dividerBefore && <div className="my-1 border-t border-linha" role="separator" />}
              <Link
                href={opt.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-1.5 text-sm no-underline transition-colors ${
                  opt.active ? 'bg-papel-2 font-bold text-tinta' : 'font-medium text-tinta hover:bg-papel-2/70'
                }`}
              >
                {opt.dotColor !== undefined && (
                  <i
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: opt.dotColor ?? 'var(--color-rosa-forte)' }}
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                {opt.active && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="shrink-0 text-laranja-texto"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </Link>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/** Cabeçalho do Extrato com ícones compactos de Lupa (expande busca) e Filtro de categorias. */
export function ExtratoHeaderBar({
  title,
  searchPlaceholder,
  searchAriaLabel,
  searchHidden,
  closeLabel,
  filterLabel,
  filterActive,
  filterOptions,
  desktopControls,
}: {
  title: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  searchHidden?: Record<string, string>;
  closeLabel: string;
  filterLabel: string;
  filterActive: boolean;
  filterOptions: FilterDropdownOption[];
  desktopControls?: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
          {title}
        </h1>
        <div className="flex items-center gap-2">
          {desktopControls}
          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            aria-expanded={searchOpen}
            aria-label={searchAriaLabel}
            title={searchAriaLabel}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
              searchOpen ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta hover:bg-papel-2'
            }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
          <FilterDropdown label={filterLabel} active={filterActive} options={filterOptions} iconOnly />
        </div>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2">
          <SearchBar
            autoFocus
            hidden={searchHidden}
            placeholder={searchPlaceholder}
            ariaLabel={searchAriaLabel}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            aria-label={closeLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-linha bg-cartao text-tinta-suave transition-colors hover:text-tinta"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function Row({
  t,
  back,
  showDate = false,
  locale = 'pt-BR',
  labels,
}: {
  t: TransactionDTO;
  back: string;
  showDate?: boolean;
  locale?: Locale;
  labels?: Dictionary['walletExtra']['txRow'];
}) {
  const txL = labels ?? getDictionary(locale).walletExtra.txRow;
  const pending = !t.categoryId && !t.isInternalTransfer;
  const sub =
    t.categoryId === 'nao-conta'
      ? `${txL.notCounted} · ${t.accountName ?? txL.manualEntry}`
      : t.isInternalTransfer
        ? txL.internalTransfer
        : pending
          ? txL.uncategorizedHint
          : [t.categoryName, t.accountName ?? txL.manualEntry].filter(Boolean).join(' · ');
  const line = showDate ? `${shortDate(t.occurredAt, locale)} · ${sub}` : sub;
  const icon = pending ? (
    <Icon src="cat/sem-categoria" size={26} />
  ) : t.isInternalTransfer ? (
    '⇄'
  ) : t.categoryId ? (
    <CatIcon id={t.categoryId} emoji={t.categoryEmoji} size={26} />
  ) : t.amountInCents > 0 ? (
    '↓'
  ) : (
    '↑'
  );
  const bg = pending ? undefined : t.isInternalTransfer ? undefined : (t.categoryColor ?? undefined);
  return (
    <Link
      href={`/carteira/${t.id}?voltar=${encodeURIComponent(back)}`}
      className={`flex min-h-[76px] items-center gap-3.5 border-b border-linha/60 py-4 text-tinta no-underline transition-colors last:border-b-0 hover:bg-papel-2/40 ${t.isInternalTransfer ? 'opacity-60' : ''}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${pending ? 'bg-rosa text-tinta' : bg ? 'text-tinta-fixa' : 'bg-papel-2 text-tinta'}`}
        style={bg ? { background: bg } : undefined}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] leading-5 font-semibold">{t.description}</span>
        <span
          className={`truncate text-[13px] leading-4 ${pending ? 'font-semibold text-laranja-texto' : 'text-tinta-suave'}`}
        >
          {line}
        </span>
        {t.note && <span className="truncate text-[12px] leading-4 text-tinta-suave italic">“{t.note}”</span>}
      </div>
      <span
        className={`shrink-0 text-[15px] tabular-nums ${t.amountInCents > 0 ? 'font-bold text-verde-texto' : 'font-semibold'}`}
      >
        {t.amountInCents > 0 ? '+ ' : ''}
        {money(Math.abs(t.amountInCents))}
      </span>
    </Link>
  );
}
