'use client';
import { useActionState } from 'react';
import { Button, ErrorNote, Field } from '@/components/ui';
import type { Dictionary } from '@/lib/i18n';
import { resetPassword, type FormState } from '../actions';

export function ResetForm({ token, t }: { token: string; t: Dictionary['authPages']['resetForm'] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label={t.newPassword} name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Field label={t.confirmPassword} name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>{pending ? t.submitPending : t.submitIdle}</Button>
    </form>
  );
}
