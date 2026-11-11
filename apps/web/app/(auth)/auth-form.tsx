'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button, ErrorNote, Field } from '@/components/ui';
import { login, register, type FormState } from './actions';

export function AuthForm({ mode }: { mode: 'entrar' | 'criar' }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === 'entrar' ? login : register, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {mode === 'criar' && <Field label="Como você quer ser chamado?" name="name" autoComplete="given-name" defaultValue={f.name} required />}
      <Field label="E-mail" name="email" type="email" autoComplete="email" defaultValue={f.email} required />
      <Field label="Senha" name="password" type="password" autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'} minLength={mode === 'criar' ? 8 : undefined} required />
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>{pending ? 'Só um segundo…' : mode === 'entrar' ? 'Entrar' : 'Criar minha conta'}</Button>
      <p className="text-center text-sm text-tinta-suave">
        {mode === 'entrar' ? <>Primeira vez? <Link href="/criar-conta" className="font-semibold text-laranja-texto">Criar conta</Link></>
          : <>Já tem conta? <Link href="/entrar" className="font-semibold text-laranja-texto">Entrar</Link></>}
      </p>
    </form>
  );
}
