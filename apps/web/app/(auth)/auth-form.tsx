'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ErrorNote } from '@/components/ui';
import { login, register, type FormState } from './actions';

const input = 'h-[50px] w-full rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none placeholder:text-tinta-suave/70 focus:border-tinta';

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[13px] font-semibold">{label}</span>
      <input {...props} className={input} />
    </label>
  );
}

function Password({ autoComplete, placeholder, minLength }: { autoComplete: string; placeholder: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[13px] font-semibold">Senha</span>
      <span className="relative">
        <input name="password" type={show ? 'text' : 'password'} autoComplete={autoComplete} placeholder={placeholder} minLength={minLength} required className={`${input} pr-[88px]`} />
        <button type="button" onClick={() => setShow(!show)} className="absolute top-[3px] right-1 h-11 px-3 text-sm font-semibold text-laranja-texto">
          {show ? 'Ocultar' : 'Mostrar'}
        </button>
      </span>
    </label>
  );
}

export function AuthForm({ mode, invite }: { mode: 'entrar' | 'criar'; invite?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === 'entrar' ? login : register, {});
  const f = state.fields ?? {};
  const criar = mode === 'criar';
  return (
    <form action={action} className="flex grow flex-col gap-3.5">
      <div className="flex flex-col gap-2.5">
        {criar && <Input label="Nome" name="name" autoComplete="given-name" placeholder="Como quer ser chamado?" defaultValue={f.name} required />}
        <Input label="E-mail" name="email" type="email" autoComplete="email" placeholder="voce@email.com" defaultValue={f.email} required />
        <Password autoComplete={criar ? 'new-password' : 'current-password'} placeholder={criar ? 'Mínimo de 8 caracteres' : 'Sua senha'} minLength={criar ? 8 : undefined} />
        {criar && (f.inviteCode ?? invite) && <input type="hidden" name="inviteCode" value={f.inviteCode ?? invite} />}
        {!criar && (
          <details className="self-end text-right">
            <summary className="flex h-10 cursor-pointer list-none items-center text-sm font-semibold text-laranja-texto">Esqueci minha senha</summary>
            <p className="max-w-[280px] text-[13px] text-tinta-suave">Fala com o Pedro, que cuida do Tostão, e ele te manda um link novo. Vale por 1 hora.</p>
          </details>
        )}
      </div>
      {criar && (
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-[19px]">
          <input type="checkbox" required className="mt-0 h-5 w-5 shrink-0 accent-tinta" />
          <span>Tenho 18 anos ou mais e topo usar um protótipo em teste.</span>
        </label>
      )}
      <ErrorNote message={state.error} />
      <button type="submit" disabled={pending} className="flex h-[54px] items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel transition active:translate-y-px disabled:opacity-50">
        {pending ? 'Só um segundo…' : criar ? 'Criar conta' : 'Entrar'}
      </button>
      {criar && (
        <p className="text-center text-[12px] leading-[17px] text-tinta-suave">
          Ao criar sua conta você concorda com os <Link href="/termos" className="font-semibold underline">Termos de uso</Link> e a <Link href="/privacidade" className="font-semibold underline">Política de privacidade</Link>.
        </p>
      )}
      <div className="grow" />
      <p className="text-center text-sm text-tinta-suave">
        {criar ? <>Já tem conta? <Link href="/entrar" className="font-bold text-laranja-texto">Entrar</Link></>
          : <>Ainda não tem conta? <Link href="/criar-conta" className="font-bold text-laranja-texto">Criar conta</Link></>}
      </p>
    </form>
  );
}
