'use client';
import { useActionState } from 'react';
import { saveBudget, type BudgetState } from './actions';

export function BudgetForm({ categoryId, label, current }: { categoryId: string; label: string; current: number | null }) {
  const [state, action, pending] = useActionState<BudgetState, FormData>(saveBudget, {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex items-center gap-2">
        <label className="flex h-11 flex-1 items-center gap-1 rounded-xl border-[1.5px] border-linha bg-papel px-3 focus-within:border-tinta">
          <span className="text-sm text-tinta-suave">R$</span>
          <input name="limit" inputMode="decimal" defaultValue={current !== null ? (current / 100).toFixed(2).replace('.', ',') : ''}
            placeholder="sem limite" aria-label={`Limite por mês em ${label}`} className="w-full bg-transparent text-base outline-none" />
        </label>
        <button type="submit" disabled={pending} className="h-11 rounded-full bg-tinta px-4 text-sm font-semibold text-papel disabled:opacity-50">{pending ? '…' : 'Salvar'}</button>
      </div>
      {state.error && <span className="text-[13px] text-vermelho-texto">{state.error}</span>}
      {state.ok && <span className="text-[13px] text-verde-texto">{state.ok}</span>}
    </form>
  );
}
