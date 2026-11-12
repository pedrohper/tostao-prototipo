'use client';
import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { Button, ErrorNote, Field } from '@/components/ui';
import { connectBank, connectItem, disconnectBank, getConnectToken, syncNow, type ConnectState } from './actions';

/**
 * Caminho principal: o widget Pluggy Connect. A pessoa escolhe o banco (ou o MeuPluggy),
 * autoriza, e o onSuccess entrega o item.id, que a gente liga ao usuário na hora.
 * Campo manual fica de plano B (e é o único caminho com BANK_GATEWAY=fake).
 */
export function ConnectPanel({ widget }: { widget: boolean }) {
  const [state, setState] = useState<ConnectState>({});
  const [pending, startTransition] = useTransition();
  const [manualState, manualAction, manualPending] = useActionState<ConnectState, FormData>(connectBank, {});
  const ok = state.ok ?? manualState.ok;

  if (ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl bg-menta-clara px-4 py-3 text-[15px] font-semibold">{ok}</p>
        <Link href="/renda" className="flex h-[54px] items-center justify-center rounded-full bg-tinta font-semibold text-papel no-underline">Agora me conta sua renda</Link>
        <Link href="/inicio" className="flex h-11 items-center justify-center text-[15px] font-semibold text-tinta no-underline">Depois, ver meu mês</Link>
      </div>
    );
  }

  function openWidget() {
    setState({});
    startTransition(async () => {
      const { connectToken, error } = await getConnectToken();
      if (error || !connectToken) {
        setState({ error: error ?? 'Essa API tá com o banco de exemplo, use o campo abaixo.' });
        return;
      }
      // Import dinâmico: o SDK mexe no window, então só pode carregar no navegador.
      const { PluggyConnect } = await import('pluggy-connect-sdk');
      let connect: InstanceType<typeof PluggyConnect> | undefined;
      const itemId = await new Promise<string | null>((resolve) => {
        connect = new PluggyConnect({
          connectToken,
          language: 'pt',
          onSuccess: ({ item }) => resolve(item.id),
          onError: ({ message }) => {
            setState({ error: `O Pluggy não conseguiu conectar: ${message}` });
            resolve(null);
          },
          onClose: () => resolve(null),
        });
        connect.init().catch(() => {
          setState({ error: 'Não deu pra abrir o Pluggy Connect. Tenta de novo?' });
          resolve(null);
        });
      });
      connect?.destroy().catch(() => {});
      if (itemId) setState(await connectItem(itemId));
    });
  }

  const manualForm = (
    <form action={manualAction} className="flex flex-col gap-3">
      <Field label="Item ID do Pluggy" name="itemId" placeholder="ex.: 3f1c2a9e-…" autoComplete="off" required />
      <ErrorNote message={manualState.error} />
      <Button type="submit" variant={widget ? 'outline' : 'primary'} disabled={manualPending}>{manualPending ? 'Farejando seu extrato…' : 'Conectar com o Item ID'}</Button>
    </form>
  );

  if (!widget) return manualForm;

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="laranja" onClick={openWidget} disabled={pending}>{pending ? 'Farejando seu extrato…' : 'Conectar meu banco'}</Button>
      <ErrorNote message={state.error} />
      <details className="rounded-2xl bg-cartao p-3">
        <summary className="cursor-pointer text-[15px] font-semibold">Já tenho um Item ID</summary>
        <div className="mt-3">{manualForm}</div>
      </details>
    </div>
  );
}

export function SyncButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(syncNow, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="rounded-full border-[1.5px] border-tinta px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50">
        {pending ? 'Sincronizando…' : 'Sincronizar agora'}
      </button>
      {state.ok && <span className="text-sm text-verde-texto">{state.ok}</span>}
      {state.error && <span className="text-sm text-vermelho-texto">{state.error}</span>}
    </form>
  );
}

export function DisconnectButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<ConnectState, FormData>(disconnectBank, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Desconectar ${name}? Some com as contas e transações que vieram dele. Gastos anotados na mão ficam.`)) e.preventDefault();
      }}
      className="flex items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-sm font-semibold text-vermelho-texto underline disabled:opacity-50">
        {pending ? 'Desconectando…' : 'Desconectar'}
      </button>
      {state.error && <span className="text-sm text-vermelho-texto">{state.error}</span>}
    </form>
  );
}
