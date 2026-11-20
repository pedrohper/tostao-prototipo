'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button, ErrorNote } from '@/components/ui';
import type { Dictionary } from '@/lib/i18n';
import { confirmEmail, resendVerification, type NoticeState } from '../actions';

type T = Dictionary['authPages']['verifyPage'];

/** O clique é o que consome o link (abrir a página não gasta o token). */
export function ConfirmForm({ token, t }: { token: string; t: T }) {
  const [state, action, pending] = useActionState<NoticeState, FormData>(confirmEmail, {});
  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-2xl bg-menta-clara p-4 text-[15px] leading-[22px]">
          {t.doneMessage}
        </p>
        <Link href="/inicio" className="text-center text-sm font-bold text-laranja-texto">
          {t.goToApp}
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <ErrorNote message={state.error} />
      {state.error && <p className="text-[13px] text-tinta-suave">{t.invalidHint}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? t.confirmPending : t.confirmCta}
      </Button>
    </form>
  );
}

/** Reenvio: exige estar logado (sem sessão, o servidor leva pra /entrar). */
export function ResendForm({ t }: { t: T }) {
  const [state, action, pending] = useActionState<NoticeState, FormData>(resendVerification, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-[15px] leading-[22px] text-tinta-suave">{t.noTokenHint}</p>
      {state.done && (
        <p role="status" className="rounded-2xl bg-menta-clara p-4 text-[15px] leading-[22px]">
          {t.resendSent}
        </p>
      )}
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? t.resendPending : t.resendCta}
      </Button>
    </form>
  );
}
