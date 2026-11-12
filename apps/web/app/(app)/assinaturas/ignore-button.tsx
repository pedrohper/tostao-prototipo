'use client';
import { useFormStatus } from 'react-dom';
import { setIgnored } from './actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="text-[13px] font-semibold text-tinta-suave underline disabled:opacity-50">{pending ? '…' : children}</button>;
}

/** "Não é assinatura" (ou desfazer). Guarda a escolha na conta: a cobrança sai da lista e do total. */
export function IgnoreButton({ subscriptionKey, ignored }: { subscriptionKey: string; ignored: boolean }) {
  return (
    <form action={setIgnored}>
      <input type="hidden" name="key" value={subscriptionKey} />
      <input type="hidden" name="ignored" value={String(!ignored)} />
      <Submit>{ignored ? 'Desfazer' : 'Não é assinatura'}</Submit>
    </form>
  );
}
