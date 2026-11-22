'use client';
import { useId, type ComponentProps } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { CategoryPicker } from '@/components/category-picker';
import { pill } from '@/components/sheet';
import { getDictionary, type Locale } from '@/lib/i18n';
import { maskMoneyInput, maskPastedMoney } from '@/lib/money-mask';
import { dateChip, dateForChip, suggestDescriptions } from '@/lib/quick-add';

// Campos que o "Anotar" completo (/anotar) e a folha rápida (quick-add-sheet) compartilham.

const field =
  'h-12 w-full rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none focus:border-tinta';

/** Valor com máscara de moeda: digita só números e eles entram como centavos (1 → 0,01 · 1250 → 12,50). */
export function AmountInput({
  value,
  onChange,
  label,
  autoFocus = false,
  name = 'amount',
}: {
  value: string;
  onChange: (masked: string) => void;
  label: string;
  autoFocus?: boolean;
  name?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold text-tinta-suave">{label}</span>
      <span className="flex items-baseline gap-1.5 border-b-2 border-tinta pb-1">
        <span className="font-display text-[28px] font-extrabold">R$</span>
        <input
          name={name}
          value={value}
          onChange={(e) => onChange(maskMoneyInput(e.target.value))}
          onPaste={(e) => {
            // Colado vem com intenção ("12" = R$ 12, "12,5" = R$ 12,50): não é a digitação em centavos.
            e.preventDefault();
            onChange(maskPastedMoney(e.clipboardData.getData('text')));
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0,00"
          required
          autoFocus={autoFocus}
          className="min-w-0 grow bg-transparent font-display text-[40px] leading-[44px] font-extrabold text-tinta tabular-nums outline-none placeholder:text-linha"
        />
      </span>
    </label>
  );
}

/** "Hoje" / "Ontem" em um toque; "Outra data" abre o seletor de data. O campo `name` leva a data (AAAA-MM-DD). */
export function DateChips({
  value,
  onChange,
  today,
  locale = 'pt-BR',
  name = 'occurredAt',
}: {
  value: string;
  onChange: (iso: string) => void;
  today: string;
  locale?: Locale;
  name?: string;
}) {
  const t = getDictionary(locale).growth.quickAdd;
  const chip = dateChip(value, today);
  const chips = [
    ['hoje', t.today],
    ['ontem', t.yesterday],
  ] as const;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{t.otherDate}</legend>
      <div className="flex flex-wrap gap-2">
        {chips.map(([c, label]) => (
          <button
            key={c}
            type="button"
            aria-pressed={chip === c}
            onClick={() => onChange(dateForChip(c, today))}
            className={`${pill(chip === c)} h-10 px-4`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={chip === 'outra'}
          onClick={() => onChange(chip === 'outra' ? value : dateForChip('ontem', today))}
          className={`${pill(chip === 'outra')} h-10 px-4`}
        >
          {t.otherDate}
        </button>
      </div>
      {/* O input sempre existe (leva o valor no envio); só fica visível em "Outra data". */}
      <input
        name={name}
        type="date"
        value={value}
        required
        onChange={(e) => onChange(e.target.value || today)}
        aria-label={t.otherDate}
        className={`${field} ${chip === 'outra' ? '' : 'sr-only'}`}
        tabIndex={chip === 'outra' ? 0 : -1}
      />
    </fieldset>
  );
}

/** Descrição com sugestões das últimas que a pessoa usou (toque preenche). */
export function DescriptionInput({
  value,
  onChange,
  recents,
  label,
  placeholder,
  name = 'description',
}: {
  value: string;
  onChange: (v: string) => void;
  recents: string[];
  label: string;
  placeholder: string;
  name?: string;
}) {
  const suggestions = suggestDescriptions(recents, value);
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={140}
        autoComplete="off"
        required
        className={field}
      />
      {suggestions.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="h-9 shrink-0 rounded-full bg-papel-2 px-3.5 text-[13px] font-semibold whitespace-nowrap text-tinta"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Categoria do lançamento: seletor em lista rolável (ícone, nome, marca) com busca e "+ Criar categoria".
 * Tocar de novo na escolhida desmarca (categoria é opcional). O id vai no campo `categoryId`.
 */
export function CategoryField({
  categories,
  kind,
  value,
  onChange,
  legend,
  locale = 'pt-BR',
  onCreate,
}: {
  categories: CategoryDTO[];
  kind: 'saida' | 'entrada';
  value: string | null;
  onChange: (id: string | null) => void;
  legend: React.ReactNode;
  locale?: Locale;
  onCreate?: ComponentProps<typeof CategoryPicker>['onCreate'];
}) {
  const t = getDictionary(locale).growth.quickAdd;
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-[13px] font-semibold">{legend}</legend>
      <CategoryPicker
        categories={categories}
        kind={kind}
        value={value}
        onChange={onChange}
        name="categoryId"
        label={t.categoryLabel}
        allowClear
        locale={locale}
        {...(onCreate ? { onCreate } : {})}
      />
    </fieldset>
  );
}

/** Nota recolhida: "+ Adicionar nota" abre o campo (e já abre sozinha se tiver texto). */
export function NoteField({
  value,
  onChange,
  open,
  onOpen,
  addLabel,
  placeholder,
  name = 'note',
}: {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onOpen: () => void;
  addLabel: string;
  placeholder: string;
  name?: string;
}) {
  if (!open && value === '') {
    return (
      <>
        <input type="hidden" name={name} value="" />
        <button
          type="button"
          onClick={onOpen}
          className="self-start text-[13px] font-semibold text-laranja-texto underline"
        >
          {addLabel}
        </button>
      </>
    );
  }
  return (
    <input
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={280}
      placeholder={placeholder}
      aria-label={addLabel}
      className={field}
    />
  );
}
