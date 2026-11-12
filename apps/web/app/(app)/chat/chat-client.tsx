'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { ChatMessageDTO } from '@tostao/contracts';
import { Mascote } from '@/components/mascote';
import { ask } from './actions';

const SUGESTOES = ['Cadê meu dinheiro?', 'Posso pedir iFood hoje?', 'Quanto pago de assinatura?', 'Onde dá pra cortar?'];

/** **negrito** e listas com "-". Sem HTML cru: o texto da IA nunca vira markup. */
function Rich({ text }: { text: string }) {
  const bold = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`} className="ml-4 list-disc">{list.map((l, i) => <li key={i}>{bold(l)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (/^[-•*]\s+/.test(line)) list.push(line.replace(/^[-•*]\s+/, ''));
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`} className="m-0">{bold(line)}</p>);
    }
  }
  flush();
  return <div className="flex flex-col gap-2">{blocks}</div>;
}

function Pensando() {
  return (
    <div className="flex items-center gap-2.5 self-start rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-4 py-3">
      <svg className="rabo-pensando" width="40" height="22" viewBox="383.3 -173.6 107.4 56.7" role="img" aria-label="Tostão está pensando">
        <path d="M391.3 -140.0 C 403.0 -160.3 423.1 -158.7 430.1 -141.2 C 435.9 -128.0 453.6 -124.9 462.3 -139.6 C 469.9 -153.5 452.7 -165.6 442.4 -153.3 C 434.4 -142.5 450.4 -129.5 464.5 -129.0 C 472.6 -128.6 479.5 -133.5 482.7 -140.0" fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[13px] text-tinta-suave">Farejando seus gastos…</span>
    </div>
  );
}

export function ChatClient({ initial, firstName, subtitle }: { initial: ChatMessageDTO[]; firstName: string; subtitle: string }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length, pending]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setDraft('');
    const temp: ChatMessageDTO = { id: `tmp-${Date.now()}`, role: 'user', content: message, createdAt: new Date().toISOString() };
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

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
      <div className="sticky top-0 z-10 -mx-5 -mt-12 flex items-center gap-2 border-b border-linha bg-cartao pt-11 pr-4 pb-3 pl-1.5 md:-mx-8 md:-mt-12 md:pt-6">
        <Link href="/inicio" aria-label="Voltar" className="flex h-11 w-11 shrink-0 items-center justify-center text-tinta">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <Mascote pose="avatar" size={44} alt="Tostão" />
        <div className="flex flex-col">
          <h1 className="font-display text-xl leading-6 font-extrabold">Tostão</h1>
          <p className="text-xs text-tinta-suave">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2.5" aria-live="polite">
        {messages.length === 0 && (
          <div className="max-w-[82%] self-start rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-3.5 py-[11px] text-[15px] leading-[22px]">
            Fala, {firstName}! Eu olho seus gastos, assinaturas e limites antes de responder. Manda a dúvida.
          </div>
        )}
        {messages.map((m) => m.role === 'user' ? (
          <div key={m.id} className="max-w-[82%] self-end whitespace-pre-wrap rounded-[18px_18px_4px_18px] bg-tinta px-3.5 py-2.5 text-[15px] leading-[22px] text-papel">{m.content}</div>
        ) : (
          <div key={m.id} className="max-w-[82%] self-start rounded-[18px_18px_18px_4px] border border-linha bg-cartao px-3.5 py-[11px] text-[15px] leading-[22px]"><Rich text={m.content} /></div>
        ))}
        {pending && <Pensando />}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[88px] -mx-5 flex flex-col gap-2.5 bg-papel px-5 pt-2 pb-1 md:bottom-0 md:pb-4">
        {error && <p role="alert" className="text-[13px] text-vermelho-texto">{error}</p>}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" disabled={pending} onClick={() => send(s)} className="h-9 shrink-0 rounded-full bg-papel-2 px-3.5 text-[13px] font-semibold disabled:opacity-50">{s}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="flex items-center gap-2">
          <label htmlFor="pergunta" className="sr-only">Pergunte ao Tostão</label>
          <input id="pergunta" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Pergunte ao Tostão" maxLength={1000} autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-linha bg-cartao px-4 text-[15px] outline-none focus:border-tinta" />
          <button type="submit" aria-label="Enviar" disabled={pending || !draft.trim()} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tinta disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FDFBF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
