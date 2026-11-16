'use client';

import { useEffect, useRef, useState } from 'react';
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
}: {
  q?: string;
  autoFocus?: boolean;
  hidden?: Record<string, string>;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <form action="/carteira/busca" role="search" className="flex h-11 items-center gap-2 rounded-full border border-linha bg-cartao px-4 transition-colors focus-within:border-tinta">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-tinta-suave"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input name="q" type="search" defaultValue={q} autoFocus={autoFocus} placeholder={placeholder} aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-tinta outline-none placeholder:text-tinta-suave" />
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </form>
  );
}

export function Chevron({ d, className = '' }: { d: string; className?: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={d} /></svg>;
}

export type FilterDropdownOption = {
  label: string;
  href: string;
  active?: boolean;
  dotColor?: string | null;
};

/** Pill dropdown para filtros da Carteira no desktop, mantendo links reais de navegação. */
export function FilterDropdown({
  label,
  active = false,
  options,
}: {
  label: string;
  active?: boolean;
  options: FilterDropdownOption[];
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex h-10 max-w-[220px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
          active ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta hover:bg-linha/60'
        }`}
      >
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
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-2 max-h-[320px] min-w-[220px] overflow-y-auto rounded-2xl border border-linha bg-cartao p-1.5 shadow-xl"
        >
          {options.map((opt) => (
            <Link
              key={`${opt.href}-${opt.label}`}
              href={opt.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex min-h-9 items-center gap-2 rounded-xl px-3 py-1.5 text-sm no-underline transition-colors ${
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-laranja-texto">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Row({ t, back, showDate = false, locale = 'pt-BR', labels }: { t: TransactionDTO; back: string; showDate?: boolean; locale?: Locale; labels?: Dictionary['walletExtra']['txRow'] }) {
  const txL = labels ?? getDictionary(locale).walletExtra.txRow;
  const pending = !t.categoryId && !t.isInternalTransfer;
  const sub = t.categoryId === 'nao-conta' ? `${txL.notCounted} · ${t.accountName ?? txL.manualEntry}`
    : t.isInternalTransfer ? txL.internalTransfer
    : pending ? txL.uncategorizedHint
      : [t.categoryName, t.accountName ?? txL.manualEntry].filter(Boolean).join(' · ');
  const line = showDate ? `${shortDate(t.occurredAt, locale)} · ${sub}` : sub;
  const icon = pending ? <Icon src="cat/sem-categoria" size={26} /> : t.isInternalTransfer ? '⇄' : t.categoryId ? <CatIcon id={t.categoryId} emoji={t.categoryEmoji} size={26} /> : (t.amountInCents > 0 ? '↓' : '↑');
  const bg = pending ? undefined : t.isInternalTransfer ? undefined : t.categoryColor ?? undefined;
  return (
    <Link href={`/carteira/${t.id}?voltar=${encodeURIComponent(back)}`}
      className={`flex min-h-[58px] items-center gap-3 border-b border-linha py-2 text-tinta no-underline transition-colors last:border-b-0 hover:bg-papel-2/40 ${t.isInternalTransfer ? 'opacity-60' : ''}`}>
      <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-lg font-bold ${pending ? 'bg-rosa text-tinta' : bg ? 'text-tinta-fixa' : 'bg-papel-2 text-tinta'}`} style={bg ? { background: bg } : undefined} aria-hidden="true">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{t.description}</span>
        <span className={`truncate text-xs ${pending ? 'font-semibold text-laranja-texto' : 'text-tinta-suave'}`}>{line}</span>
      </div>
      <span className={`shrink-0 text-[15px] tabular-nums ${t.amountInCents > 0 ? 'font-bold text-verde-texto' : 'font-semibold'}`}>
        {t.amountInCents > 0 ? '+ ' : ''}{money(Math.abs(t.amountInCents))}
      </span>
    </Link>
  );
}
