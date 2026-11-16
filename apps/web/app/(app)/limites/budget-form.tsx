'use client';
import { useActionState } from 'react';
import { getDictionary, type Dictionary } from '@/lib/i18n';
import { saveBudget, type BudgetState } from './actions';

export function BudgetForm({
  categoryId,
  label,
  current,
  t,
  saveLabel,
}: {
  categoryId: string;
  label: string;
  current: number | null;
  t?: Dictionary['pages']['limites']['form'];
  saveLabel?: string;
}) {
  const dict = getDictionary('pt-BR');
  const labels = t ?? dict.pages.limites.form;
  const saveTxt = saveLabel ?? dict.common.save;
  const [state, action, pending] = useActionState<BudgetState, FormData>(saveBudget, {});
  return (
    <form action={action} className="flex flex-col gap-1">
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
      {state.ok && <span className="text-[13px] text-verde-texto">{state.ok}</span>}
    </form>
  );
}
