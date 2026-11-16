'use client';
import { useActionState, useState } from 'react';
import { getDictionary, type Dictionary } from '@/lib/i18n';
import { addFriend, removeFriend, type AmigoState } from './actions';

/** Compartilha o link (ou copia, se o celular não tiver o menu de compartilhar). */
export function Compartilhar({ code, t }: { code: string; t?: Dictionary['pages']['amigos']['client'] }) {
  const labels = t ?? getDictionary('pt-BR').pages.amigos.client;
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

export function AdicionarAmigo({ t }: { t?: Dictionary['pages']['amigos']['client'] }) {
  const labels = t ?? getDictionary('pt-BR').pages.amigos.client;
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

export function Remover({ id, name, t }: { id: string; name: string; t?: Dictionary['pages']['amigos']['client'] }) {
  const labels = t ?? getDictionary('pt-BR').pages.amigos.client;
  return (
    <button
      type="button"
      aria-label={labels.removeAria(name)}
      className="flex h-9 w-9 items-center justify-center text-tinta-suave"
      onClick={() => {
        if (confirm(labels.removeConfirm(name))) void removeFriend(id);
      }}
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
  );
}
