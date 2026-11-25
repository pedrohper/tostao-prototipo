'use client';

import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CatIcon, Icon } from '@/components/icone';
import Link from 'next/link';
import type { TransactionDTO } from '@tostao/contracts';
import { money, shortDate } from '@/lib/format';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n';
import { withQuery } from '@/lib/wallet-search';
import { toggleTransactionSettled } from './actions';

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
        className="min-w-0 flex-1 bg-transparent text-body text-tinta outline-none placeholder:text-tinta-suave"
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
  /** Título de grupo mostrado antes desta opção (ex.: "Conta ou cartão"). */
  groupLabel?: string;
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
            : `inline-flex h-11 max-w-[44vw] items-center gap-1.5 rounded-full border px-3 text-small font-semibold whitespace-nowrap transition-colors sm:max-w-[220px] sm:px-4 sm:text-sm ${
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
              {opt.groupLabel && (
                <div
                  role="presentation"
                  className="px-3 pt-1.5 pb-1 text-mini font-bold tracking-[0.08em] text-tinta-suave uppercase"
                >
                  {opt.groupLabel}
                </div>
              )}
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

/**
 * Busca do extrato que filtra enquanto digita (espera 300 ms parada e troca `?q=` na URL sem recarregar nem perder o
 * foco). Enter continua indo pra busca global em todos os meses (/carteira/busca), e sem JavaScript também funciona.
 */
export function InlineSearch({
  q,
  hidden,
  placeholder,
  ariaLabel,
  clearLabel,
  hint,
  autoFocus = false,
}: {
  q: string;
  hidden?: Record<string, string>;
  placeholder: string;
  ariaLabel: string;
  clearLabel: string;
  hint: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(q);
  const [, startTransition] = useTransition();
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startTransition(() => router.replace(`${pathname}${withQuery(params, value)}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
    // `params` muda depois de cada replace: só a digitação (value) reinicia o relógio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <form
        action="/carteira/busca"
        role="search"
        className="flex h-11 items-center gap-2 rounded-full border border-linha bg-cartao px-3.5 transition-colors focus-within:border-tinta sm:px-4"
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={ariaLabel}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-body text-tinta outline-none placeholder:text-tinta-suave"
        />
        {value !== '' && (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label={clearLabel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-tinta-suave hover:text-tinta"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
        {Object.entries(hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      </form>
      {value.trim() !== '' && <span className="px-3 text-mini text-tinta-suave">{hint}</span>}
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
  q = '',
  clearSearchLabel = 'Limpar busca',
  searchHint = '',
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
  /** Busca atual (`?q=`): a barra já abre preenchida. */
  q?: string;
  clearSearchLabel?: string;
  searchHint?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(q !== '');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Fechar a busca também tira o `?q=` da URL: senão o extrato ficaria filtrado sem barra visível.
  const toggleSearch = () => {
    if (searchOpen && q !== '') router.replace(`${pathname}${withQuery(params, '')}`, { scroll: false });
    setSearchOpen((prev) => !prev);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-hero lg:leading-[34px]">
          {title}
        </h1>
        <div className="flex items-center gap-2">
          {desktopControls}
          <button
            type="button"
            onClick={toggleSearch}
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
          <InlineSearch
            q={q}
            autoFocus
            hidden={searchHidden}
            placeholder={searchPlaceholder}
            ariaLabel={searchAriaLabel}
            clearLabel={clearSearchLabel}
            hint={searchHint}
          />
          <button
            type="button"
            onClick={toggleSearch}
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
  const unpaid = t.settled === false && !t.isInternalTransfer;
  const quickSettleLabel =
    t.amountInCents > 0
      ? locale === 'en'
        ? 'Received'
        : locale === 'es'
          ? 'Recibido'
          : 'Recebi'
      : locale === 'en'
        ? 'Paid'
        : locale === 'es'
          ? 'Pagado'
          : 'Paguei';
  const pendingTag = locale === 'en' ? 'Pending' : locale === 'es' ? 'Pendiente' : 'Pendente';
  const tagClasses =
    'rounded-full bg-amarelo-claro px-2 py-0.5 text-mini leading-4 font-bold text-laranja-texto uppercase';

  return (
    // Pendente no celular: o selo e o botão de baixa descem pra uma linha própria, pra o nome do lançamento caber.
    <div
      className={`flex min-h-[76px] items-center gap-x-2 border-b border-linha/60 last:border-b-0 ${unpaid ? 'flex-wrap sm:flex-nowrap' : ''} ${t.isInternalTransfer ? 'opacity-60' : ''}`}
    >
      <Link
        href={`/carteira/${t.id}?voltar=${encodeURIComponent(back)}`}
        className={`flex min-w-0 grow items-center gap-3.5 py-4 text-tinta no-underline transition-colors hover:bg-papel-2/40 ${unpaid ? 'basis-full sm:basis-0' : 'basis-0'}`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${pending ? 'bg-rosa text-tinta' : bg ? 'text-tinta-fixa' : 'bg-papel-2 text-tinta'}`}
          style={bg ? { background: bg } : undefined}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-body leading-5 font-semibold">{t.customDescription || t.description}</span>
          <div className="flex min-w-0 items-center gap-1.5">
            {unpaid && <span className={`hidden shrink-0 sm:inline ${tagClasses}`}>{pendingTag}</span>}
            <span
              className={`truncate text-small leading-4 ${pending ? 'font-semibold text-laranja-texto' : 'text-tinta-suave'}`}
            >
              {line}
            </span>
          </div>
          {t.note && <span className="truncate text-mini leading-4 text-tinta-suave italic">“{t.note}”</span>}
        </div>
        <span
          className={`shrink-0 text-body tabular-nums ${t.amountInCents > 0 ? 'font-bold text-verde-texto' : 'font-semibold'}`}
        >
          {t.amountInCents > 0 ? '+ ' : ''}
          {money(Math.abs(t.amountInCents))}
        </span>
      </Link>
      {unpaid && (
        <form
          action={toggleTransactionSettled}
          className="-mt-2 flex w-full items-center justify-between gap-2 pb-3 pl-[54px] sm:mt-0 sm:w-auto sm:shrink-0 sm:p-0"
        >
          <span className={`sm:hidden ${tagClasses}`}>{pendingTag}</span>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="settled" value="true" />
          <input type="hidden" name="kind" value={t.amountInCents > 0 ? 'entrada' : 'saida'} />
          <input type="hidden" name="back" value={back} />
          <button
            type="submit"
            className="h-8 rounded-full border border-linha bg-papel-2 px-2.5 text-xs font-bold text-tinta transition-colors hover:bg-tinta hover:text-papel"
          >
            {quickSettleLabel}
          </button>
        </form>
      )}
    </div>
  );
}
