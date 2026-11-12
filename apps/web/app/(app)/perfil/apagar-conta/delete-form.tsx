'use client';
import { useActionState } from 'react';
import { ErrorNote, Field } from '@/components/ui';
import { deleteAccount, type DeleteAccountState } from './actions';

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Sua senha" name="password" type="password" autoComplete="current-password" required />
      <label className="flex items-start gap-2.5 text-sm leading-5">
        <input type="checkbox" name="confirmo" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#B42318]" />
        <span>Entendi que isso apaga tudo de vez e não tem como desfazer.</span>
      </label>
      <ErrorNote message={state.error} />
      <button type="submit" disabled={pending} className="flex h-[54px] w-full items-center justify-center rounded-full bg-[#B42318] text-base font-bold text-white transition active:translate-y-px disabled:opacity-50">
        {pending ? 'Apagando…' : 'Apagar minha conta'}
      </button>
    </form>
  );
}
