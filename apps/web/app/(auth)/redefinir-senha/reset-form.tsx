'use client';
import { useActionState } from 'react';
import { Button, ErrorNote, Field } from '@/components/ui';
import { resetPassword, type FormState } from '../actions';

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Senha nova" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Field label="Repete a senha" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar e entrar'}</Button>
    </form>
  );
}
