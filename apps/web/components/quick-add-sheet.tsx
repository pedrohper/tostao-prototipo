'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createManual, loadQuickAddData, type ActionState, type QuickAddData } from '@/app/(app)/carteira/actions';
import { ErrorNote } from '@/components/ui';
import { useToast } from '@/components/toast';
import { getDictionary, type Locale } from '@/lib/i18n';
import { canSaveQuickAdd } from '@/lib/quick-add';
import { centsFromMasked } from '@/lib/money-mask';
import { AmountInput, CategoryField, DateChips, DescriptionInput, NoteField } from './quick-add-fields';

/**
 * Formulário compacto de anotar: valor com máscara, Hoje/Ontem, descrição com sugestões, categoria com ícone, nota
 * recolhida e "Salvar e anotar outro". Conta, repetir e parcelar ficam no /anotar completo (link no rodapé).
 */
export function QuickAddForm({
  data,
  locale = 'pt-BR',
  fullFormHref,
  onSaved,
}: {
  data: QuickAddData;
  locale?: Locale;
  fullFormHref: string;
  /** Chamado depois de salvar. `another` = a pessoa quer anotar outro (a folha não fecha). */
  onSaved: (another: boolean) => void;
}) {
  const q = getDictionary(locale).growth.quickAdd;
  const toast = useToast();
  const [sending, setSending] = useState<'stay' | 'another'>('stay');
  const [kind, setKind] = useState<'saida' | 'entrada'>('saida');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(data.today);
  const [description, setDescription] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  // "Repetir todo mês" automático (T5.2): a folha cria uma regra mensal (dinheiro/sem conta). Parcelar e conta: no /anotar.
  const [monthly, setMonthly] = useState(false);

  // Roda a cada envio (não num efeito): mostra o toast, limpa o que muda de um lançamento pro outro e avisa a folha.
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await createManual(prev, formData);
    if (result.saved) {
      const another = formData.get('intent') === 'another';
      toast.success(another ? q.savedAnother : kind === 'entrada' ? 'Entrada anotada.' : 'Gasto anotado.');
      if (another) {
        // Mantém tipo e data (quem anota vários de uma vez costuma ser do mesmo dia); limpa o resto.
        setAmount('');
        setDescription('');
        setCat(null);
        setNote('');
        setNoteOpen(false);
        setMonthly(false);
      }
      onSaved(another);
    }
    return result;
  }, {});

  const ready = canSaveQuickAdd({ cents: centsFromMasked(amount), description });

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="back" value="/carteira" />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {(['saida', 'entrada'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setCat(null);
            }}
            className={`flex h-10 items-center justify-center rounded-full text-[15px] font-semibold transition-colors ${kind === k ? 'bg-tinta text-papel' : 'text-tinta'}`}
          >
            {k === 'saida' ? q.kindOut : q.kindIn}
          </button>
        ))}
      </div>
      <AmountInput value={amount} onChange={setAmount} label={q.amountLabel} autoFocus />
      <DateChips value={date} onChange={setDate} today={data.today} locale={locale} />
      <DescriptionInput
        value={description}
        onChange={setDescription}
        recents={data.recents}
        label={q.descLabel}
        placeholder={q.descPlaceholder}
      />
      <CategoryField
        categories={data.categories}
        kind={kind}
        value={cat}
        onChange={setCat}
        legend={q.categoryLabel}
        locale={locale}
      />
      <NoteField
        value={note}
        onChange={setNote}
        open={noteOpen}
        onOpen={() => setNoteOpen(true)}
        addLabel={q.addNote}
        placeholder={q.notePlaceholder}
      />
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] border-linha bg-cartao px-3 py-2.5">
        <input
          type="checkbox"
          checked={monthly}
          onChange={(e) => setMonthly(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-tinta)]"
        />
        <span className="flex flex-col text-[14px] leading-5">
          <b className="font-semibold">Repetir todo mês</b>
          <span className="text-[12px] leading-[17px] text-tinta-suave">
            O Tostão lança sozinho no dia. Pra parcelar ou escolher a conta, use “Mais opções”.
          </span>
        </span>
      </label>
      {monthly && (
        <>
          <input type="hidden" name="repeat" value="mensal" />
          <input type="hidden" name="automatic" value="on" />
        </>
      )}
      <ErrorNote message={state.error} />
      <div className="flex flex-col gap-2 pt-1">
        <button
          type="submit"
          name="intent"
          value="stay"
          disabled={pending || !ready}
          onClick={() => {
            setSending('stay');
          }}
          className="flex h-[52px] items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50"
        >
          {pending && sending === 'stay' ? q.saving : q.save}
        </button>
        <button
          type="submit"
          name="intent"
          value="another"
          disabled={pending || !ready}
          onClick={() => {
            setSending('another');
          }}
          className="flex h-11 items-center justify-center rounded-full border-[1.5px] border-tinta text-[15px] font-semibold text-tinta disabled:opacity-50"
        >
          {pending && sending === 'another' ? q.saving : q.saveAnother}
        </button>
        <Link href={fullFormHref} className="self-center py-1 text-[13px] font-semibold text-tinta-suave underline">
          {q.fullForm}
        </Link>
      </div>
    </form>
  );
}

/** Folha que sobe de baixo (e vira diálogo no desktop). Fecha no X, no fundo escurecido e no Esc. */
export function QuickAddSheet({
  open,
  onClose,
  locale = 'pt-BR',
}: {
  open: boolean;
  onClose: () => void;
  locale?: Locale;
}) {
  const q = getDictionary(locale).growth.quickAdd;
  const pathname = usePathname();
  const [data, setData] = useState<QuickAddData | null>(null);
  const [failed, setFailed] = useState(false);
  const loading = useRef(false);

  // Os dados vêm quando a folha abre pela primeira vez (e ficam em memória nas próximas aberturas).
  useEffect(() => {
    if (!open || data || loading.current) return;
    loading.current = true;
    setFailed(false);
    loadQuickAddData()
      .then((r) => {
        if (r.data) setData(r.data);
        else setFailed(true);
      })
      .catch(() => setFailed(true))
      .finally(() => {
        loading.current = false;
      });
  }, [open, data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label={q.close}
        onClick={onClose}
        tabIndex={-1}
        className="absolute inset-0 bg-tinta-fixa/45 motion-safe:animate-[toast-in_0.15s_ease-out]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={q.title}
        className="relative flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[26px] border border-linha bg-papel shadow-2xl md:rounded-[26px]"
      >
        <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-1">
          <span className="mx-auto h-1 w-10 rounded-full bg-linha md:hidden" aria-hidden="true" />
          <h2 className="sr-only md:not-sr-only md:font-display md:text-xl md:font-extrabold">{q.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={q.close}
            className="absolute top-2 right-3 flex h-10 w-10 items-center justify-center rounded-full text-tinta hover:bg-papel-2"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pt-2 pb-[max(24px,env(safe-area-inset-bottom))]">
          {data ? (
            <QuickAddForm
              data={data}
              locale={locale}
              fullFormHref={`/anotar?voltar=${encodeURIComponent(pathname)}`}
              onSaved={(another) => {
                if (!another) onClose();
              }}
            />
          ) : failed ? (
            <p role="alert" className="py-8 text-center text-sm font-semibold text-vermelho-texto">
              {q.loadError}
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-tinta-suave">{q.loading}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Botão que abre a folha: `fab` (laranja, flutuante, some no desktop `lg:`) ou `inline` (pílula na página). */
export function QuickAddButton({
  variant = 'inline',
  label,
  locale = 'pt-BR',
}: {
  variant?: 'fab' | 'inline';
  label: string;
  locale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const cleanLabel = variant === 'fab' ? label.replace(/^\+\s*/, '') : label;
  const className =
    variant === 'fab'
      ? 'fixed right-5 bottom-[calc(86px+env(safe-area-inset-bottom))] z-20 flex h-13 items-center gap-2 rounded-full bg-laranja pr-5 pl-4 text-[15px] font-bold text-tinta-fixa shadow-[0_4px_16px_rgba(30,27,24,0.28)] md:bottom-6 lg:hidden'
      : 'flex h-11 items-center justify-center rounded-full bg-laranja px-5 text-[15px] font-bold text-tinta-fixa';
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className}>
        {variant === 'fab' && (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
        {cleanLabel}
      </button>
      <QuickAddSheet open={open} onClose={() => setOpen(false)} locale={locale} />
    </>
  );
}
