'use client';
import { useActionState } from 'react';
import { autoCategorize, type AutoState } from './actions';

/** Botão na aba "sem categoria": a IA tenta categorizar o que as regras não pegaram. */
export function AutoCategorizeButton() {
  const [state, action, pending] = useActionState<AutoState>(autoCategorize, {});
  return (
    <form action={action} className="flex flex-col gap-1.5 rounded-2xl bg-amarelo-claro p-3.5">
      <p className="text-[14px] leading-snug text-tinta">
        <strong>Deixa que eu tento?</strong> Eu reconheço loja, app e serviço. Pix pra pessoa fica com você.
      </p>
      <button type="submit" disabled={pending} className="self-start rounded-full bg-tinta px-4 py-2 text-[13px] font-semibold text-papel disabled:opacity-60">
        {pending ? 'Categorizando…' : '✨ Categorizar pra mim'}
      </button>
      {state.message && <p role="status" className="text-[13px] text-tinta-suave">{state.message}</p>}
    </form>
  );
}
