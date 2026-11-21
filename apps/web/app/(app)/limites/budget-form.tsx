'use client';
import { useActionState, useEffect, useRef } from 'react';
import { useToast } from '@/components/toast';
import { getDictionary, type Locale } from '@/lib/i18n';
import { saveBudget, type BudgetState } from './actions';

export function BudgetForm({
  categoryId,
  label,
  current,
  locale = 'pt-BR',
}: {
  categoryId: string;
  label: string;
  current: number | null;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const labels = dict.pages.limites.form;
  const saveTxt = dict.common.save;
  const [state, action, pending] = useActionState<BudgetState, FormData>(saveBudget, {});
  const toast = useToast();
  const undoLabel = dict.growth.toast.undo;
  const undoneText = dict.growth.toast.undone;
  // O limite de ANTES do envio: depois do salvar o servidor revalida e `current` já vem com o valor novo.
  const before = useRef<number | null>(current);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) {
      const previous = before.current;
      toast.success(state.ok, {
        actionLabel: undoLabel,
        onAction: async () => {
          const fd = new FormData();
          fd.set('categoryId', categoryId);
          fd.set('limit', previous === null ? '' : (previous / 100).toFixed(2).replace('.', ','));
          const res = await saveBudget({}, fd);
          if (res.error) toast.error(res.error);
          else toast.info(undoneText);
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a um novo resultado da ação
  }, [state]);
  return (
    <form
      action={action}
      onSubmit={() => {
        before.current = current;
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex items-center gap-2">
        <label className="flex h-11 flex-1 items-center gap-1 rounded-xl border-[1.5px] border-linha bg-papel px-3 focus-within:border-tinta">
          <span className="text-sm text-tinta-suave">R$</span>
          <input
            name="limit"
            inputMode="decimal"
            defaultValue={current !== null ? (current / 100).toFixed(2).replace('.', ',') : ''}
            placeholder={labels.placeholder}
            aria-label={labels.ariaPrefix(label)}
            className="w-full bg-transparent text-base outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-full bg-tinta px-4 text-sm font-semibold text-papel disabled:opacity-50"
        >
          {pending ? '…' : saveTxt}
        </button>
      </div>
      {state.error && <span className="text-[13px] text-vermelho-texto">{state.error}</span>}
    </form>
  );
}
