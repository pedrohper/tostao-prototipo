'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { createCategoryInline } from '@/app/(app)/categorias/actions';
import { CatIcon } from '@/components/icone';
import { getDictionary, type Locale } from '@/lib/i18n';
import {
  createAndClassify,
  filterCategories,
  mergeCategories,
  SEARCH_THRESHOLD,
  SOFT_COLORS,
  swallowEnter,
  visibleCategories,
  type CreateResult,
  type NewCategoryInput,
} from '@/lib/category-picker';

export type CategoryPickerProps = {
  /** Lista completa vinda do servidor; o seletor filtra por `kind` (e inclui "Não conta" se `includeNeutral`). */
  categories: CategoryDTO[];
  kind: 'saida' | 'entrada';
  value: string | null;
  /** Chama com o id (ou `null` ao desmarcar) e, quando há, a categoria inteira (útil logo depois de criar uma). */
  onChange: (id: string | null, category?: CategoryDTO) => void;
  /** Nome ou rótulo do grupo pra leitor de tela (a legenda visível fica com quem usa o seletor). */
  label: string;
  /** Com `name`, o seletor leva o id escolhido num `<input type="hidden">` (serve pra `<form action>`). */
  name?: string;
  includeNeutral?: boolean;
  /** Tocar na categoria já escolhida (ou no ×) desmarca (categoria opcional, como no Anotar). */
  allowClear?: boolean;
  disabled?: boolean;
  locale?: Locale;
  /** `dropdown` (seleção suspensa, padrão) ou `inline` (lista sempre aberta, usado na fila de categorizar). */
  variant?: 'dropdown' | 'inline';
  /** Criação inline. Padrão: Server Action (POST /categories). Os testes passam um mock. */
  onCreate?: (input: NewCategoryInput) => Promise<CreateResult>;
  /** Só pra teste/SSR: já abre o painel (no dropdown) e o mini-form de "+ Criar categoria". */
  defaultOpen?: boolean;
};

const DEFAULT_COLOR: Record<'saida' | 'entrada', string> = { saida: '#FFE3D6', entrada: '#DDF6E8' };

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 text-tinta-suave transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Seletor de categorias: por padrão aparece como seleção suspensa (`dropdown`) com busca e "+ Criar categoria" dentro
 * do painel; no modo `inline` (fila de categorizar) mantém a lista aberta pra classificar em um toque.
 */
export function CategoryPicker({
  categories,
  kind,
  value,
  onChange,
  label,
  name,
  includeNeutral = false,
  allowClear = false,
  disabled = false,
  locale = 'pt-BR',
  variant = 'dropdown',
  onCreate = createCategoryInline,
  defaultOpen = false,
}: CategoryPickerProps) {
  const t = getDictionary(locale).growth.categoryPicker;
  const ids = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const justCreated = useRef<string | null>(null);

  const [created, setCreated] = useState<CategoryDTO[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(defaultOpen);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'saida' | 'entrada'>(kind);
  const [newColor, setNewColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const allMerged = useMemo(() => mergeCategories(categories, created), [categories, created]);
  const options = useMemo(() => visibleCategories(allMerged, kind, includeNeutral), [allMerged, kind, includeNeutral]);
  const shown = filterCategories(options, query);
  const showSearch = options.length > SEARCH_THRESHOLD;
  const color = newColor ?? DEFAULT_COLOR[newKind];
  const selectedCategory = useMemo(
    () => (value ? (options.find((c) => c.id === value) ?? allMerged.find((c) => c.id === value) ?? null) : null),
    [value, options, allMerged],
  );

  // A categoria recém-criada pode estar no fim de uma lista longa: leva ela pra dentro da área visível.
  useEffect(() => {
    const id = justCreated.current;
    if (!id || value !== id) return;
    justCreated.current = null;
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? []);
    rows.find((r) => r.dataset.catId === id)?.scrollIntoView?.({ block: 'nearest' });
  }, [value, shown.length]);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  // Fecha o dropdown ao tocar fora dele.
  useEffect(() => {
    if (variant !== 'dropdown' || !dropdownOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [variant, dropdownOpen]);

  const openForm = () => {
    setNewKind(kind);
    setNewColor(null);
    setNewName('');
    setError(null);
    setNote(null);
    setOpen(true);
  };

  const selectCategory = (c: CategoryDTO) => {
    const selected = value === c.id;
    if (allowClear && selected) {
      onChange(null);
    } else {
      onChange(c.id, c);
      if (variant === 'dropdown') {
        setDropdownOpen(false);
        setQuery('');
      }
    }
  };

  const submit = async () => {
    if (busy || newName.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const out = await createAndClassify(onCreate, { name: newName, kind: newKind, color }, kind, t.createError);
    setBusy(false);
    if (out.status === 'error') {
      setError(out.message);
      return;
    }
    const category = out.category;
    setCreated((prev) => [...prev, category]);
    setOpen(false);
    if (out.status === 'selected') {
      justCreated.current = category.id;
      setQuery('');
      onChange(category.id, category);
      if (variant === 'dropdown') setDropdownOpen(false);
    } else {
      setNote(t.createdOtherKind(category.name, category.kind === 'entrada' ? 'entrada' : 'saida'));
    }
  };

  const placeholderLabel =
    locale === 'en' ? 'Choose category' : locale === 'es' ? 'Elegir categoría' : 'Escolher categoria';
  const clearLabel = locale === 'en' ? 'Clear category' : locale === 'es' ? 'Quitar categoría' : 'Limpar categoria';

  const panelContent = (
    <div className="flex flex-col gap-2.5">
      {showSearch && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => swallowEnter(e)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 w-full rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none focus:border-tinta"
        />
      )}
      <div
        ref={listRef}
        role="radiogroup"
        aria-label={label}
        className="max-h-[42dvh] overflow-y-auto overscroll-contain rounded-2xl border border-linha bg-cartao"
      >
        {shown.length === 0 ? (
          <p className="px-4 py-5 text-center text-sm text-tinta-suave">{t.noResults}</p>
        ) : (
          shown.map((c) => {
            const selected = value === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={selected}
                data-cat-id={c.id}
                disabled={disabled}
                onClick={() => selectCategory(c)}
                className={`flex min-h-12 w-full items-center gap-3 border-b border-linha px-3 py-1.5 text-left last:border-b-0 disabled:opacity-50 ${selected ? 'bg-papel-2' : ''}`}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-tinta-fixa"
                  style={{ backgroundColor: c.color }}
                >
                  <CatIcon id={c.id} emoji={c.emoji} size={20} />
                </span>
                <span className="min-w-0 grow truncate text-[15px] font-semibold">{c.name}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${selected ? 'border-tinta bg-tinta text-papel' : 'border-linha'}`}
                >
                  {selected && <Check />}
                </span>
              </button>
            );
          })
        )}
      </div>
      {note && (
        <p role="status" className="text-[13px] leading-[18px] text-tinta-suave">
          {note}
        </p>
      )}
      {!open ? (
        <button
          type="button"
          onClick={openForm}
          disabled={disabled}
          aria-expanded={false}
          className="flex h-12 w-full items-center justify-center rounded-2xl border-[1.5px] border-dashed border-linha text-[15px] font-semibold text-laranja-texto disabled:opacity-50"
        >
          {t.create}
        </button>
      ) : (
        <div role="group" aria-label={t.createTitle} className="flex flex-col gap-3 rounded-2xl bg-papel-2 p-3.5">
          <p className="text-[13px] font-bold">{t.createTitle}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-nome`} className="text-[13px] font-semibold text-tinta-suave">
              {t.nameLabel}
            </label>
            <input
              id={`${ids}-nome`}
              ref={nameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => swallowEnter(e, submit)}
              placeholder={t.namePlaceholder}
              maxLength={30}
              autoComplete="off"
              className="h-12 w-full rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none focus:border-tinta"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-tinta-suave">{t.kindLabel}</span>
            <div
              role="radiogroup"
              aria-label={t.kindLabel}
              className="grid grid-cols-2 gap-1 rounded-full bg-cartao p-1"
            >
              {(['saida', 'entrada'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={newKind === k}
                  onClick={() => setNewKind(k)}
                  className={`flex h-10 items-center justify-center rounded-full text-[15px] font-semibold ${newKind === k ? 'bg-tinta text-papel' : 'text-tinta'}`}
                >
                  {k === 'saida' ? t.kindOut : t.kindIn}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-tinta-suave">{t.colorLabel}</span>
            <div role="radiogroup" aria-label={t.colorLabel} className="flex flex-wrap gap-2">
              {SOFT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={color === c.hex}
                  aria-label={t.colorNames[c.id]}
                  onClick={() => setNewColor(c.hex)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-tinta-fixa ring-offset-2 ring-offset-papel-2 ${color === c.hex ? 'ring-2 ring-tinta' : 'ring-1 ring-linha'}`}
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.hex && <Check />}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-[13px] font-semibold text-vermelho-texto">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-linha text-[15px] font-semibold text-tinta disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || newName.trim().length < 2}
              className="flex h-11 items-center justify-center rounded-full bg-laranja text-[15px] font-bold text-tinta-fixa disabled:opacity-50"
            >
              {busy ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="flex flex-col gap-2.5">
        {name && <input type="hidden" name={name} value={value ?? ''} />}
        {panelContent}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={dropdownOpen}
          aria-label={label}
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex h-12 min-w-0 flex-1 items-center justify-between gap-2.5 rounded-xl border-[1.5px] border-linha bg-cartao px-3.5 text-left transition-colors focus:border-tinta disabled:opacity-50"
        >
          {selectedCategory ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-tinta-fixa"
                style={{ backgroundColor: selectedCategory.color }}
              >
                <CatIcon id={selectedCategory.id} emoji={selectedCategory.emoji} size={16} />
              </span>
              <span className="truncate text-[15px] font-semibold text-tinta">{selectedCategory.name}</span>
            </span>
          ) : (
            <span className="truncate text-[15px] text-tinta-suave">{placeholderLabel}</span>
          )}
          <ChevronDown open={dropdownOpen} />
        </button>
        {allowClear && selectedCategory && (
          <button
            type="button"
            disabled={disabled}
            aria-label={clearLabel}
            onClick={() => onChange(null)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-linha bg-cartao text-base font-semibold text-tinta-suave hover:bg-papel-2 hover:text-tinta"
          >
            ×
          </button>
        )}
      </div>
      {dropdownOpen && <div className="rounded-2xl border border-linha bg-papel p-2.5 shadow-lg">{panelContent}</div>}
    </div>
  );
}
