'use client';
import { useActionState } from 'react';
import { ErrorNote, Field } from '@/components/ui';
import { deleteAccount, type DeleteAccountState } from './actions';

type Labels = {
  passwordLabel: string;
  emailLabel: string;
  emailHint: string;
  confirmLabel: string;
  submit: string;
  pending: string;
};

export function DeleteAccountForm({
  hasPassword,
  email,
  labels,
}: {
  hasPassword: boolean;
  email: string;
  labels: Labels;
}) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {hasPassword ? (
        <Field label={labels.passwordLabel} name="password" type="password" autoComplete="current-password" required />
      ) : (
        <div className="flex flex-col gap-1">
          <Field
            label={labels.emailLabel}
            name="confirmEmail"
            type="email"
            autoComplete="email"
            placeholder={email}
            required
          />
          <p className="text-xs text-tinta-suave">{labels.emailHint}</p>
        </div>
      )}
      <label className="flex items-start gap-2.5 text-sm leading-5">
        <input type="checkbox" name="confirmo" required className="mt-0.5 h-5 w-5 shrink-0 accent-alerta" />
        <span>{labels.confirmLabel}</span>
      </label>
      <ErrorNote message={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="flex h-[54px] w-full items-center justify-center rounded-full bg-alerta text-base font-bold text-papel-fixo transition active:translate-y-px disabled:opacity-50"
      >
        {pending ? labels.pending : labels.submit}
      </button>
    </form>
  );
}
