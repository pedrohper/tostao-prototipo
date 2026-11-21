'use client';
import { useActionState, useState } from 'react';
import { ConfirmAction } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { getDictionary, type Locale } from '@/lib/i18n';
import { addFriend, removeFriend, respondFriendRequest, type AmigoState } from './actions';

/** Compartilha o link (ou copia, se o celular não tiver o menu de compartilhar). */
export function Compartilhar({ code, locale = 'pt-BR' }: { code: string; locale?: Locale }) {
  const labels = getDictionary(locale).pages.amigos.client;
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="flex h-[50px] w-full items-center justify-center rounded-full bg-tinta text-[15px] font-semibold text-papel"
      onClick={async () => {
        const url = `${location.origin}/criar-conta?convite=${code}`;
        const text = labels.shareText(url);
        if (navigator.share) {
          await navigator.share({ title: 'Tostão', text }).catch(() => {});
          return;
        }
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? labels.copied : labels.shareBtn}
    </button>
  );
}

export function AdicionarAmigo({ locale = 'pt-BR' }: { locale?: Locale }) {
  const labels = getDictionary(locale).pages.amigos.client;
  const [state, action, pending] = useActionState<AmigoState, FormData>(addFriend, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="code" className="text-[13px] font-semibold">
        {labels.addLabel}
      </label>
      <div className="flex gap-2">
        <input
          id="code"
          name="code"
          placeholder="TOST-AB3CD"
          autoCapitalize="characters"
          className="h-[50px] min-w-0 grow rounded-[14px] border-[1.5px] border-linha bg-cartao px-3.5 font-mono text-[15px] uppercase outline-none focus:border-tinta"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-[50px] shrink-0 rounded-full border-[1.5px] border-tinta px-5 text-[15px] font-semibold disabled:opacity-60"
        >
          {pending ? '…' : labels.addBtn}
        </button>
      </div>
      {(state.error || state.message) && (
        <p
          role="status"
          className={`text-[13px] ${state.error ? 'font-semibold text-vermelho-texto' : 'text-verde-texto'}`}
        >
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}

export function Remover({ id, name, locale = 'pt-BR' }: { id: string; name: string; locale?: Locale }) {
  const dict = getDictionary(locale);
  const labels = dict.pages.amigos.client;
  const toast = useToast();
  return (
    <ConfirmAction
      title={dict.system.removeFriendTitle}
      description={labels.removeConfirm(name)}
      confirmLabel={dict.common.delete}
      cancelLabel={dict.common.cancel}
      onConfirm={() => {
        removeFriend(id).catch(() => toast.error(dict.system.actionFailed));
      }}
      trigger={(open) => (
        <button
          type="button"
          aria-label={labels.removeAria(name)}
          aria-haspopup="dialog"
          className="flex h-11 w-11 items-center justify-center text-tinta-suave"
          onClick={open}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    />
  );
}

/** Pedido de amizade recebido: aceitar entra no ranking dos dois; recusar some. */
export function PedidoRecebido({ id, name, locale = 'pt-BR' }: { id: string; name: string; locale?: Locale }) {
  const labels = getDictionary(locale).pages.amigos.client;
  return (
    <div className="flex min-h-[58px] items-center gap-3 border-b border-linha last:border-b-0">
      <span className="grow text-[15px]">{labels.incomingText(name)}</span>
      <button
        type="button"
        className="h-9 shrink-0 rounded-full bg-tinta px-4 text-sm font-semibold text-papel"
        onClick={() => void respondFriendRequest(id, true)}
      >
        {labels.acceptBtn}
      </button>
      <button
        type="button"
        className="h-9 shrink-0 rounded-full border-[1.5px] border-linha px-4 text-sm font-semibold text-tinta-suave"
        onClick={() => void respondFriendRequest(id, false)}
      >
        {labels.declineBtn}
      </button>
    </div>
  );
}
