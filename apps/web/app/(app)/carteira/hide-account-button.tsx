'use client';
import { useFormStatus } from 'react-dom';
import { getDictionary, type Dictionary } from '@/lib/i18n';
import { setAccountHidden } from './actions';

/** Olho aberto = conta aparece; olho riscado = conta oculta. Toque troca. */
function Submit({ hidden, t }: { hidden: boolean; t?: Dictionary['walletExtra']['hideAccount'] }) {
  const { pending } = useFormStatus();
  const labels = t ?? getDictionary('pt-BR').walletExtra.hideAccount;
  const label = hidden ? labels.show : labels.hide;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-laranja-texto disabled:opacity-50"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

/** Ocultar conta que você não usa (ou mostrar de novo). */
export function HideAccountButton({
  accountId,
  hidden,
  t,
}: {
  accountId: string;
  hidden: boolean;
  t?: Dictionary['walletExtra']['hideAccount'];
}) {
  return (
    <form action={setAccountHidden}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="hidden" value={String(!hidden)} />
      <Submit hidden={hidden} t={t} />
    </form>
  );
}
