'use client';
import { useActionState } from 'react';
import type { Dictionary } from '@/lib/i18n';
import { ErrorNote, Field } from '@/components/ui';
import { deleteAccount, type DeleteAccountState } from './actions';

export function DeleteAccountForm({ t }: { t: Dictionary['pages']['deleteAccount']['form'] }) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t.passwordLabel} name="password" type="password" autoComplete="current-password" required />
      <label className="flex items-start gap-2.5 text-sm leading-5">
        <input type="checkbox" name="confirmo" required className="mt-0.5 h-5 w-5 shrink-0 accent-alerta" />
        <span>{t.confirmLabel}</span>
      </label>
      <ErrorNote message={state.error} />
      <button type="submit" disabled={pending} className="flex h-[54px] w-full items-center justify-center rounded-full bg-alerta text-base font-bold text-papel-fixo transition active:translate-y-px disabled:opacity-50">
        {pending ? t.pending : t.submit}
      </button>
    </form>
  );
}
