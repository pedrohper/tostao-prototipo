'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button, ErrorNote, Field } from '@/components/ui';
import { connectBank, syncNow, type ConnectState } from './actions';

export function ConnectForm() {
  const [state, action, pending] = useActionState<ConnectState, FormData>(connectBank, {});
  if (state.ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl bg-menta-clara px-4 py-3 text-[15px] font-semibold">{state.ok}</p>
        <Link href="/inicio" className="flex h-[54px] items-center justify-center rounded-full bg-laranja font-bold text-[#1E1B18] no-underline">Ver meu mês</Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Item ID do Meu Pluggy" name="itemId" placeholder="ex.: 3f1c2a9e-…" autoComplete="off" required />
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>{pending ? 'Farejando seu extrato…' : 'Conectar meu banco'}</Button>
    </form>
  );
}

export function SyncButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(syncNow, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="rounded-full border-[1.5px] border-tinta px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50">
        {pending ? 'Sincronizando…' : 'Sincronizar agora'}
      </button>
      {state.ok && <span className="text-sm text-verde-texto">{state.ok}</span>}
      {state.error && <span className="text-sm text-vermelho-texto">{state.error}</span>}
    </form>
  );
}
