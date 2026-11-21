'use client';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import type { ChatCardDTO, ChatMessageDTO, PendingActionDTO } from '@tostao/contracts';
import { useRouter } from 'next/navigation';
import { AiConsentCard } from '@/components/ai-consent-card';
import { ChatCards, ProposalCard } from '@/components/chat-cards';
import { EMPTY_STREAM_VIEW, reduceStreamView, runChatStream, type StreamView } from '@/lib/chat-stream';
import { setAiConsentAction } from '@/lib/consent-actions';
import { getDictionary, type Locale } from '@/lib/i18n';
import { Mascot } from '@/components/mascote';
import { ask, resolvePendingAction } from './actions';

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
  locale = 'pt-BR',
}: {
  initial: ChatMessageDTO[];
  firstName: string;
  subtitle: string;
  askIncome?: boolean;
  initialQuery?: string;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.pages.chatExtra;
  const tc = dict.growth.chat;
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const router = useRouter();
  const [proposal, setProposal] = useState<PendingActionDTO | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [resolving, startResolve] = useTransition();
  // Resposta chegando (null = nenhuma pergunta em andamento), cartões por resposta e sugestões do último turno.
  const [streaming, setStreaming] = useState<StreamView | null>(null);
  const [cardsByReply, setCardsByReply] = useState<Record<string, ChatCardDTO[]>>({});
  const [followUps, setFollowUps] = useState<string[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const sending = streaming !== null;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, sending, streaming?.text.length]);

  // Saiu da tela no meio de uma resposta: cancela (o servidor para a IA e não grava nada).
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setError(null);
    setDraft('');
    setFollowUps(null);
    const temp: ChatMessageDTO = {
      id: `tmp-${crypto.randomUUID()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, temp]);
    setProposal(null);
    setStreaming(EMPTY_STREAM_VIEW);

    const abort = new AbortController();
    abortRef.current = abort;
    const outcome = await runChatStream({
      message,
      signal: abort.signal,
      onEvent: (event) => setStreaming((view) => (view ? reduceStreamView(view, event) : view)),
    });
    setStreaming(null);
    const undo = (problem?: string) => {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setDraft(message);
      if (problem) setError(problem);
    };
    const finish = (r: {
      question: ChatMessageDTO;
      reply: ChatMessageDTO;
      pendingAction: PendingActionDTO | null;
      cards?: ChatCardDTO[];
      followUps?: string[];
    }) => {
      setMessages((m) => [...m.filter((x) => x.id !== temp.id), r.question, r.reply]);
      setProposal(r.pendingAction);
      if (r.cards?.length) setCardsByReply((c) => ({ ...c, [r.reply.id]: r.cards ?? [] }));
      setFollowUps(r.followUps?.length ? r.followUps : null);
    };

    switch (outcome.kind) {
      case 'done':
        return finish(outcome.event);
      case 'fallback': {
        // Streaming indisponível (rede, proxy, API sem a rota): o caminho de sempre, só que sem o efeito de digitação.
        const r = await ask(message);
        if (r.ok) return finish(r.data);
        undo();
        if (r.needsConsent) setNeedsConsent(true);
        else setError(r.error);
        return;
      }
      case 'consent':
        undo();
        return setNeedsConsent(true);
      case 'unauthorized':
        window.location.assign('/sair');
        return;
      case 'interrupted':
        return undo(tc.streamInterrupted);
      case 'error':
        return undo(outcome.message);
      case 'aborted':
        return;
    }
  };

  const answerProposal = (confirm: boolean) => {
    if (!proposal || resolving) return;
    const id = proposal.id;
    startResolve(async () => {
      const r = await resolvePendingAction(id, confirm);
      setProposal(null);
      if (!r.ok) return setError(r.error);
      setError(null);
      setMessages((m) => [
        ...m,
        { id: `conf-${id}`, role: 'assistant', content: r.message, createdAt: new Date().toISOString() },
      ]);
    });
  };

  const disableAi = () =>
    startResolve(async () => {
      await setAiConsentAction(false);
      router.refresh();
    });

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });

  useEffect(() => {
    if (!initialQuery || autoSent.current) return;
    autoSent.current = true;
    window.history.replaceState(null, '', '/tostao');
    void sendRef.current(initialQuery);
  }, [initialQuery]);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      {askIncome && (
        <Link
          href="/renda?voltar=/tostao"
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-amarelo-claro px-3.5 py-2.5 text-[13px] leading-[18px] text-tinta no-underline"
        >
          <span className="min-w-0 flex-1">{t.askIncomeBanner}</span>
          <span className="shrink-0 font-semibold text-laranja-texto">{t.askIncomeCta}</span>
        </Link>
      )}

      <div className="relative min-h-0 flex-1">
        {/* "?" flutuando no canto: o status (o que o Tostão sabe até quando) só ocupa lugar quando a pessoa pede. */}
        <div className="absolute top-0 right-0 z-10 flex max-w-[85%] flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
            aria-controls="chat-status"
            aria-label={`Tostão: ${subtitle}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-linha bg-cartao text-sm font-bold text-tinta-suave shadow-sm transition hover:text-tinta"
          >
            ?
          </button>
          {showInfo && (
            <div
              id="chat-status"
              className="flex items-center gap-2.5 rounded-2xl border border-linha bg-cartao px-3.5 py-2.5 shadow-md"
            >
              <Mascot pose="avatar" size={32} alt="" still />
              <p className="min-w-0 flex-1 text-xs leading-[17px] text-tinta-suave">{subtitle}</p>
              <button
                type="button"
                onClick={disableAi}
                disabled={resolving}
                className="shrink-0 text-xs font-semibold text-laranja-texto underline disabled:opacity-50"
              >
                Desativar IA
              </button>
            </div>
          )}
        </div>
        <div
          className="h-full overflow-y-auto overscroll-contain pr-0.5"
          // Durante o streaming o leitor de tela não deve narrar cada palavra: lê a resposta inteira quando fecha.
          aria-live={sending ? 'off' : 'polite'}
          aria-busy={sending}
        >
          <div className="flex min-h-full flex-col justify-end gap-2.5 py-1">
            {messages.length === 0 && (
              <div className="max-w-[85%] min-w-0 self-start break-words [overflow-wrap:anywhere] rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-3.5 py-[11px] text-[15px] leading-[22px]">
                {t.emptyGreeting(firstName)}
              </div>
            )}
            {messages.map((m) => (
              <Fragment key={m.id}>
                {m.role === 'user' ? (
                  <div className="max-w-[85%] min-w-0 self-end break-words [overflow-wrap:anywhere] whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-tinta px-3.5 py-2.5 text-[15px] leading-[22px] text-papel">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[85%] min-w-0 self-start break-words [overflow-wrap:anywhere] rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-3.5 py-[11px] text-[15px] leading-[22px]">
                    <Rich text={m.content} />
                  </div>
                )}
                {cardsByReply[m.id] && <ChatCards cards={cardsByReply[m.id] ?? []} locale={locale} />}
              </Fragment>
            ))}
            {streaming &&
              (streaming.text ? (
                <div className="max-w-[85%] min-w-0 self-start break-words [overflow-wrap:anywhere] rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-3.5 py-[11px] text-[15px] leading-[22px]">
                  <Rich text={streaming.text} />
                </div>
              ) : (
                <Pensando ariaLabel={t.thinkingAria} text={streaming.status ?? tc.statusThinking} />
              ))}
            <div ref={bottom} />
          </div>
        </div>
      </div>

      <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 bg-papel pt-1">
        {needsConsent && <AiConsentCard onAccepted={() => setNeedsConsent(false)} compact />}
        {proposal && (
          <ProposalCard
            proposal={proposal}
            busy={resolving}
            locale={locale}
            onConfirm={() => answerProposal(true)}
            onCancel={() => answerProposal(false)}
          />
        )}
        {error && (
          <p role="alert" className="text-[13px] text-vermelho-texto">
            {error}
          </p>
        )}
        <div role="group" aria-label={tc.followUpsAria} className="flex w-full min-w-0 gap-2 overflow-x-auto pb-0.5">
          {(followUps ?? t.suggestions).map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => void send(q)}
              className="h-9 shrink-0 rounded-full bg-papel-2 px-3.5 text-[13px] font-semibold text-tinta disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          className="flex w-full min-w-0 items-center gap-2"
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
            disabled={sending || !draft.trim()}
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
