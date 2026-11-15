'use client';
import { useActionState, useState } from 'react';
import { ErrorNote } from '@/components/ui';
import { createManualAccount, type ActionState } from './actions';

const field = 'h-11 min-w-0 w-full rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta';

export function AddAccountBox() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'BANK' | 'CREDIT'>('BANK');
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const res = await createManualAccount(prev, form);
    if (!res.error) setOpen(false);
    return res;
  }, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 self-start rounded-full border border-dashed border-linha px-3.5 py-2 text-xs font-semibold text-tinta-suave hover:border-tinta hover:text-tinta">
        <span className="text-sm leading-none">+</span> Nova conta ou cartão manual
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">Nova conta ou cartão manual</span>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-tinta-suave underline">Cancelar</button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {([['BANK', 'Conta'], ['CREDIT', 'Cartão']] as const).map(([v, label]) => (
          <label key={v} className={`flex h-9 cursor-pointer items-center justify-center rounded-full text-xs font-semibold ${type === v ? 'bg-tinta text-papel' : 'text-tinta'}`}>
            <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
        <input name="name" placeholder={type === 'CREDIT' ? 'Ex.: Cartão do meu pai' : 'Ex.: Nubank'} required maxLength={40} className={field} />
        <input name="balance" inputMode="decimal" placeholder={type === 'CREDIT' ? 'Fatura R$' : 'Saldo R$'} className={field} />
      </div>
      <ErrorNote message={state.error} />
      <button type="submit" disabled={pending} className="flex h-10 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel disabled:opacity-50">
        {pending ? 'Adicionando…' : 'Adicionar'}
      </button>
    </form>
  );
}
