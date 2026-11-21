'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button, ErrorNote, Field } from '@/components/ui';
import type { Dictionary } from '@/lib/i18n';
import { requestPasswordReset, type NoticeState } from '../actions';

export function ForgotForm({ t }: { t: Dictionary['authPages']['forgotPage'] }) {
  const [state, action, pending] = useActionState<NoticeState, FormData>(requestPasswordReset, {});
  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-2xl bg-menta-clara p-4 text-[15px] leading-[22px]">
          {t.sentMessage}
        </p>
        <Link href="/entrar" className="text-center text-sm font-bold text-laranja-texto">
          {t.backToLogin}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label={t.emailLabel}
        name="email"
        type="email"
        autoComplete="email"
        placeholder={t.emailPlaceholder}
        required
      />
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? t.submitPending : t.submitIdle}
      </Button>
      <Link href="/entrar" className="text-center text-sm font-bold text-laranja-texto">
        {t.backToLogin}
      </Link>
    </form>
  );
}
