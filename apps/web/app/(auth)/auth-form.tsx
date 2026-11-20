'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ErrorNote } from '@/components/ui';
import type { Dictionary } from '@/lib/i18n';
import { login, register, type FormState } from './actions';

const input =
  'h-[50px] w-full rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none placeholder:text-tinta-suave/70 focus:border-tinta';

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[13px] font-semibold">{label}</span>
      <input {...props} className={input} />
    </label>
  );
}

function Password({
  label,
  showLabel,
  hideLabel,
  autoComplete,
  placeholder,
  minLength,
}: {
  label: string;
  showLabel: string;
  hideLabel: string;
  autoComplete: string;
  placeholder: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="relative">
        <input
          name="password"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          required
          className={`${input} pr-[88px]`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute top-[3px] right-1 h-11 px-3 text-sm font-semibold text-laranja-texto"
        >
          {show ? hideLabel : showLabel}
        </button>
      </span>
    </label>
  );
}

export function AuthForm({
  mode,
  invite,
  t,
}: {
  mode: 'entrar' | 'criar';
  invite?: string;
  t: Dictionary['authPages']['form'];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === 'entrar' ? login : register, {});
  const f = state.fields ?? {};
  const criar = mode === 'criar';
  return (
    <form action={action} className="flex grow flex-col gap-3.5">
      <div className="flex flex-col gap-2.5">
        {criar && (
          <Input
            label={t.nameLabel}
            name="name"
            autoComplete="given-name"
            placeholder={t.namePlaceholder}
            defaultValue={f.name}
            required
          />
        )}
        <Input
          label={t.emailLabel}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t.emailPlaceholder}
          defaultValue={f.email}
          required
        />
        <Password
          label={t.passwordLabel}
          showLabel={t.show}
          hideLabel={t.hide}
          autoComplete={criar ? 'new-password' : 'current-password'}
          placeholder={criar ? t.passwordNewPlaceholder : t.passwordCurrentPlaceholder}
          minLength={criar ? 8 : undefined}
        />
        {criar && (f.inviteCode ?? invite) && <input type="hidden" name="inviteCode" value={f.inviteCode ?? invite} />}
        {!criar && (
          <Link
            href="/esqueci-senha"
            className="flex h-10 items-center self-end text-sm font-semibold text-laranja-texto no-underline hover:underline"
          >
            {t.forgotPassword}
          </Link>
        )}
      </div>
      {criar && (
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-[19px]">
          <input type="checkbox" name="acceptedTerms" required className="mt-0 h-5 w-5 shrink-0 accent-tinta" />
          <span>
            {t.acceptTermsPrefix}
            <Link href="/termos" className="font-semibold underline">
              {t.termsLink}
            </Link>
            {t.andWord}
            <Link href="/privacidade" className="font-semibold underline">
              {t.privacyLink}
            </Link>
            {t.termsSuffix}
          </span>
        </label>
      )}
      <ErrorNote message={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="flex h-[54px] items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel transition active:translate-y-px disabled:opacity-50"
      >
        {pending ? t.submitPending : criar ? t.createAccount : t.signIn}
      </button>
      <div className="grow lg:grow-0" />
      <p className="text-center text-sm text-tinta-suave">
        {criar ? (
          <>
            {t.hasAccountPrefix}
            <Link href="/entrar" className="font-bold text-laranja-texto">
              {t.signIn}
            </Link>
          </>
        ) : (
          <>
            {t.noAccountPrefix}
            <Link href="/criar-conta" className="font-bold text-laranja-texto">
              {t.createAccount}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
