'use client';
import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icone';
import { Button, ErrorNote, Field } from '@/components/ui';
import { getDictionary, type Locale } from '@/lib/i18n';
import { connectBank, connectItem, disconnectBank, getConnectToken, syncNow, type ConnectState } from './actions';

/**
 * Caminho principal: o widget Pluggy Connect. A pessoa escolhe o banco (ou o MeuPluggy),
 * autoriza, e o onSuccess entrega o item.id, que a gente liga ao usuário na hora.
 * Campo manual fica de plano B (e é o único caminho com BANK_GATEWAY=fake).
 */
export type ConnectCard = { icon: string; bg: string; title: string; tag: string | null; desc: string };

export function ConnectPanel({
  widget,
  novo = false,
  locale = 'pt-BR',
  layout = 'default',
  card,
}: {
  widget: boolean;
  novo?: boolean;
  locale?: Locale;
  /**
   * default: botão do widget + "Já tenho um Item ID" recolhido (tela normal).
   * card: só o cartão "Conectar banco" do onboarding, que abre o widget direto.
   * manual: só o campo de Item ID (vai dentro do bloco "Avançado e suporte").
   */
  layout?: 'default' | 'card' | 'manual';
  card?: ConnectCard;
}) {
  const labels = getDictionary(locale).pages.conectar.panel;
  const [state, setState] = useState<ConnectState>({});
  const [pending, startTransition] = useTransition();
  const [manualState, manualAction, manualPending] = useActionState<ConnectState, FormData>(connectBank, {});
  const ok = state.ok ?? manualState.ok;

  if (ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl bg-menta-clara px-4 py-3 text-[15px] font-semibold">{ok}</p>
        <Link
          href={novo ? '/renda?novo=1' : '/renda'}
          className="flex h-[54px] items-center justify-center rounded-full bg-tinta font-semibold text-papel no-underline"
        >
          {labels.goIncome}
        </Link>
        <Link
          href="/inicio"
          className="flex h-11 items-center justify-center text-[15px] font-semibold text-tinta no-underline"
        >
          {labels.laterMonth}
        </Link>
      </div>
    );
  }

  function openWidget() {
    setState({});
    startTransition(async () => {
      const { connectToken, error } = await getConnectToken();
      if (error || !connectToken) {
        setState({ error: error ?? labels.fallbackError });
        return;
      }
      // Import dinâmico: o SDK mexe no window, então só pode carregar no navegador.
      const { PluggyConnect } = await import('pluggy-connect-sdk');
      let connect: InstanceType<typeof PluggyConnect> | undefined;
      const itemId = await new Promise<string | null>((resolve) => {
        connect = new PluggyConnect({
          connectToken,
          language: locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt',
          onSuccess: ({ item }) => resolve(item.id),
          onError: ({ message }) => {
            setState({ error: labels.pluggyError(message) });
            resolve(null);
          },
          onClose: () => resolve(null),
        });
        connect.init().catch(() => {
          setState({ error: labels.initError });
          resolve(null);
        });
      });
      connect?.destroy().catch(() => {});
      if (itemId) setState(await connectItem(itemId));
    });
  }

  const manualForm = (
    <form action={manualAction} className="flex flex-col gap-3">
      <Field label={labels.itemIdLabel} name="itemId" placeholder="ex.: 3f1c2a9e-…" autoComplete="off" required />
      <ErrorNote message={manualState.error} />
      <Button type="submit" variant={widget ? 'outline' : 'primary'} disabled={manualPending}>
        {manualPending ? labels.connecting : labels.connectItemId}
      </Button>
    </form>
  );

  if (layout === 'manual' || !widget) return manualForm;

  if (layout === 'card' && card) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={openWidget}
          disabled={pending}
          className="flex w-full items-center gap-3 rounded-2xl border border-linha bg-cartao p-3.5 text-left text-tinta transition-colors hover:bg-papel-2 disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.bg}`}
          >
            <Icon src={card.icon} size={30} />
          </span>
          <span className="flex min-w-0 grow flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-bold">
              {pending ? labels.connecting : card.title}
              {card.tag && (
                <span className="rounded-full bg-amarelo-claro px-2 py-0.5 text-[11px] font-semibold text-tinta">
                  {card.tag}
                </span>
              )}
            </span>
            <span className="text-[13px] leading-[18px] text-tinta-suave">{card.desc}</span>
          </span>
          <span className="shrink-0 text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </button>
        <ErrorNote message={state.error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="laranja" onClick={openWidget} disabled={pending}>
        {pending ? labels.connecting : labels.connectBank}
      </Button>
      <ErrorNote message={state.error} />
      <details className="rounded-2xl bg-cartao p-3">
        <summary className="cursor-pointer text-[15px] font-semibold">{labels.haveItemId}</summary>
        <div className="mt-3">{manualForm}</div>
      </details>
    </div>
  );
}

export function SyncButton({ id, locale = 'pt-BR' }: { id: string; locale?: Locale }) {
  const labels = getDictionary(locale).pages.conectar.panel;
  const [state, action, pending] = useActionState<ConnectState, FormData>(syncNow, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border-[1.5px] border-tinta px-3.5 py-1.5 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? labels.syncing : labels.syncNow}
      </button>
      {state.ok && <span className="text-sm text-verde-texto">{state.ok}</span>}
      {state.error && <span className="text-sm text-vermelho-texto">{state.error}</span>}
    </form>
  );
}

export function DisconnectButton({ id, name, locale = 'pt-BR' }: { id: string; name: string; locale?: Locale }) {
  const labels = getDictionary(locale).pages.conectar.panel;
  const [state, action, pending] = useActionState<ConnectState, FormData>(disconnectBank, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(labels.disconnectConfirm(name))) e.preventDefault();
      }}
      className="flex items-center gap-3"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-semibold text-vermelho-texto underline disabled:opacity-50"
      >
        {pending ? labels.disconnecting : labels.disconnect}
      </button>
      {state.error && <span className="text-sm text-vermelho-texto">{state.error}</span>}
    </form>
  );
}
