'use client';
import { useFormStatus } from 'react-dom';
import { setAccountHidden } from './actions';

/** Olho aberto = conta aparece; olho riscado = conta oculta. Toque troca. */
function Submit({ hidden }: { hidden: boolean }) {
  const { pending } = useFormStatus();
  const label = hidden ? 'Mostrar conta' : 'Ocultar conta';
  return (
    <button type="submit" disabled={pending} aria-label={label} title={label} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-laranja-texto disabled:opacity-50">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        {hidden && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

/** Ocultar conta que você não usa (ou mostrar de novo). */
export function HideAccountButton({ accountId, hidden }: { accountId: string; hidden: boolean }) {
  return (
    <form action={setAccountHidden}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="hidden" value={String(!hidden)} />
      <Submit hidden={hidden} />
    </form>
  );
}
