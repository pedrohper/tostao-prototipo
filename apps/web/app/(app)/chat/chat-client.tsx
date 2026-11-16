'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { ChatMessageDTO } from '@tostao/contracts';
import type { Dictionary } from '@/lib/i18n';
import { Mascot } from '@/components/mascote';
import { ask } from './actions';

/** **negrito** e listas com "-". Sem HTML cru: o texto da IA nunca vira markup. */
function Rich({ text }: { text: string }) {
  const bold = (line: string) =>
    line
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>,
      );
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      blocks.push(
        <ul key={`l${blocks.length}`} className="ml-4 list-disc">
          {list.map((l, i) => (
            <li key={i}>{bold(l)}</li>
          ))}
        </ul>,
      );
    list = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (/^[-•*]\s+/.test(line)) list.push(line.replace(/^[-•*]\s+/, ''));
    else {
      flush();
      if (line)
        blocks.push(
          <p key={`p${blocks.length}`} className="m-0">
            {bold(line)}
          </p>,
        );
    }
  }
  flush();
  return <div className="flex flex-col gap-2">{blocks}</div>;
}

function Pensando({ ariaLabel, text }: { ariaLabel: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5 self-start rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-4 py-3">
      <svg
        className="rabo-pensando"
        width="40"
        height="22"
        viewBox="383.3 -173.6 107.4 56.7"
        role="img"
        aria-label={ariaLabel}
      >
        <path
          d="M391.3 -140.0 C 403.0 -160.3 423.1 -158.7 430.1 -141.2 C 435.9 -128.0 453.6 -124.9 462.3 -139.6 C 469.9 -153.5 452.7 -165.6 442.4 -153.3 C 434.4 -142.5 450.4 -129.5 464.5 -129.0 C 472.6 -128.6 479.5 -133.5 482.7 -140.0"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[13px] text-tinta-suave">{text}</span>
    </div>
  );
}

export function ChatClient({
  initial,
  firstName,
  subtitle,
  askIncome = false,
  initialQuery,
  t,
}: {
  initial: ChatMessageDTO[];
  firstName: string;
  subtitle: string;
  askIncome?: boolean;
  initialQuery?: string;
  t: Dictionary['pages']['chatExtra'];
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, pending]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setDraft('');
    const temp: ChatMessageDTO = {
      id: `tmp-${crypto.randomUUID()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, temp]);
    start(async () => {
      const r = await ask(message);
      if (r.ok) setMessages((m) => [...m.filter((x) => x.id !== temp.id), r.data.question, r.data.reply]);
      else {
        setMessages((m) => m.filter((x) => x.id !== temp.id));
        setDraft(message);
        setError(r.error);
      }
    });
  };

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => {
    if (!initialQuery || autoSent.current) return;
    autoSent.current = true;
    window.history.replaceState(null, '', '/tostao');
    sendRef.current(initialQuery);
  }, [initialQuery]);

  return (
    <div className="flex min-h-[calc(100dvh-16rem)] w-full flex-col gap-4 md:min-h-[calc(100dvh-13rem)] lg:min-h-[calc(100dvh-11rem)]">
      <div className="flex items-center gap-2.5 rounded-2xl border border-linha bg-cartao px-3.5 py-2.5">
        <Mascot pose="avatar" size={38} alt="Tostão" still />
        <p className="text-xs leading-[17px] text-tinta-suave">{subtitle}</p>
      </div>

      {askIncome && (
        <Link
          href="/renda?voltar=/tostao"
          className="flex items-center gap-2 rounded-2xl bg-amarelo-claro px-3.5 py-3 text-[13px] leading-[19px] text-tinta no-underline"
        >
          <span className="grow">{t.askIncomeBanner}</span>
          <span className="shrink-0 font-semibold text-laranja-texto">{t.askIncomeCta}</span>
        </Link>
      )}

      <div className="flex flex-1 flex-col justify-end gap-2.5" aria-live="polite">
        {messages.length === 0 && (
          <div className="max-w-[82%] self-start rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-3.5 py-[11px] text-[15px] leading-[22px]">
            {t.emptyGreeting(firstName)}
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="max-w-[82%] self-end whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-tinta px-3.5 py-2.5 text-[15px] leading-[22px] text-papel"
            >
              {m.content}
            </div>
          ) : (
            <div
              key={m.id}
              className="max-w-[82%] self-start rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-3.5 py-[11px] text-[15px] leading-[22px]"
            >
              <Rich text={m.content} />
            </div>
          ),
        )}
        {pending && <Pensando ariaLabel={t.thinkingAria} text={t.thinkingText} />}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[88px] -mx-5 flex flex-col gap-2.5 bg-papel px-5 pt-2 pb-1 md:bottom-0 md:mx-0 md:px-0 md:pb-2">
        {error && (
          <p role="alert" className="text-[13px] text-vermelho-texto">
            {error}
          </p>
        )}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
          {t.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => send(s)}
              className="h-9 shrink-0 rounded-full bg-papel-2 px-3.5 text-[13px] font-semibold text-tinta disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="pergunta" className="sr-only">
            {t.inputAria}
          </label>
          <input
            id="pergunta"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.inputPlaceholder}
            maxLength={1000}
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-linha bg-cartao px-4 text-[15px] text-tinta placeholder:text-tinta-suave outline-none focus:border-tinta"
          />
          <button
            type="submit"
            aria-label={t.sendAria}
            disabled={pending || !draft.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tinta text-papel disabled:opacity-40"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
