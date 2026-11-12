'use client';
import { useFormStatus } from 'react-dom';
import { setAccountHidden } from './actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="shrink-0 text-xs font-semibold text-laranja-texto underline disabled:opacity-50">{pending ? '…' : children}</button>;
}

/** Ocultar conta que você não usa (ou mostrar de novo). */
export function HideAccountButton({ accountId, hidden }: { accountId: string; hidden: boolean }) {
  return (
    <form action={setAccountHidden}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="hidden" value={String(!hidden)} />
      <Submit>{hidden ? 'Mostrar' : 'Ocultar'}</Submit>
    </form>
  );
}
