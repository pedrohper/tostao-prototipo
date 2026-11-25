'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  SCAM_CHECKLIST_ACTIONS,
  SCAM_CHECKLIST_SIGNS,
  SCAM_FALLBACK_NOTES,
  SCAM_FINAL_ADVICE,
  SCAM_HEADLINES,
  SCAM_MESSAGE_MAX,
  SCAM_MESSAGE_MIN,
  type ScamCheckResponse,
  type ScamRisk,
} from '@tostao/contracts';
import { AiConsentCard } from '@/components/ai-consent-card';
import { analisarMensagem } from '@/app/(app)/tostao/golpe/actions';

const RISK_CARD: Record<ScamRisk, string> = { alto: 'bg-rosa', medio: 'bg-amarelo-claro', baixo: 'bg-menta-clara' };

/** A lista fixa, pra quando não tem análise nenhuma (sem aceite, sem rede). */
const OFFLINE_CHECKLIST: ScamCheckResponse = {
  source: 'checklist',
  risk: null,
  reason: 'sem_ia',
  signs: [...SCAM_CHECKLIST_SIGNS],
  actions: [...SCAM_CHECKLIST_ACTIONS],
  advice: SCAM_FINAL_ADVICE,
};

function Lista({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[20px] border border-linha bg-cartao p-4">
      <h3 className="text-[15px] font-bold text-tinta">{title}</h3>
      <ul className="ml-4 flex list-disc flex-col gap-1.5 text-[14px] leading-[20px] text-tinta">
        {items.map((item) => (
          <li key={item} className="[overflow-wrap:anywhere]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Resultado da análise (ou a lista fixa). Sempre texto puro: nada do que veio de fora vira link. */
export function ResultadoGolpe({ result, note }: { result: ScamCheckResponse; note?: string }) {
  return (
    <div className="flex flex-col gap-3">
      {result.source === 'ia' ? (
        <div className={`flex flex-col gap-1 rounded-[20px] p-4 text-tinta ${RISK_CARD[result.risk]}`}>
          <h2 className="font-display text-[22px] leading-[27px] font-extrabold">{SCAM_HEADLINES[result.risk]}</h2>
          <p className="text-[13px] leading-[18px] text-tinta-suave">É uma leitura do texto, não uma certeza.</p>
        </div>
      ) : (
        <p className="text-[15px] leading-[21px] font-semibold text-tinta">
          {note ?? SCAM_FALLBACK_NOTES[result.reason]}
        </p>
      )}
      <Lista title={result.source === 'ia' ? 'Sinais' : 'Sinais de golpe'} items={result.signs} />
      <Lista title="O que fazer" items={result.actions} />
      <p className="rounded-[20px] bg-tinta p-4 text-center text-[15px] leading-[21px] font-bold text-papel">
        {result.advice}
      </p>
    </div>
  );
}

export function GolpeForm({ consented }: { consented: boolean }) {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ScamCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [pending, startTransition] = useTransition();
  const output = useRef<HTMLDivElement>(null);
  const showConsent = !consented || needsConsent;

  useEffect(() => {
    if (result || error) output.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [result, error]);

  const analyze = () =>
    startTransition(async () => {
      setError(null);
      setResult(null);
      // Sem rede, a própria chamada da ação falha: a pessoa ainda assim recebe a lista.
      const r = await analisarMensagem(message).catch(() => ({ ok: false as const, error: 'Sem conexão agora.' }));
      if (r.ok) return setResult(r.data);
      if ('needsConsent' in r && r.needsConsent) return setNeedsConsent(true);
      setError(r.error);
    });

  return (
    <div className="flex flex-col gap-3">
      {showConsent && <AiConsentCard onAccepted={() => setNeedsConsent(false)} compact />}

      <form
        method="post"
        onSubmit={(e) => {
          e.preventDefault();
          analyze();
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="mensagem-suspeita" className="text-sm font-semibold text-tinta">
          Mensagem que você recebeu
        </label>
        <textarea
          id="mensagem-suspeita"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={SCAM_MESSAGE_MAX}
          rows={6}
          placeholder="Cola o texto aqui"
          className="w-full resize-y rounded-2xl border-[1.5px] border-linha bg-cartao p-3.5 text-base leading-[22px] text-tinta outline-none placeholder:text-tinta-suave focus:border-tinta"
        />
        <p className="text-xs leading-[18px] text-tinta-suave">
          Só texto (print eu ainda não leio). Antes de ir pra IA (DeepSeek), escondo CPF, e-mail, telefone, números de
          conta e cartão e o seu nome. Nada fica salvo no Tostão.
        </p>
        <button
          type="submit"
          disabled={pending || showConsent || message.trim().length < SCAM_MESSAGE_MIN}
          className="h-[54px] rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50"
        >
          {pending ? 'Analisando…' : 'Analisar'}
        </button>
      </form>

      <div ref={output} aria-live="polite" className="flex scroll-mt-4 flex-col gap-3 empty:hidden">
        {error && (
          <p role="alert" className="rounded-2xl bg-rosa px-4 py-3 text-sm font-medium text-tinta">
            {error}
          </p>
        )}
        {result ? (
          <ResultadoGolpe result={result} />
        ) : error ? (
          <ResultadoGolpe result={OFFLINE_CHECKLIST} note="Enquanto isso, confere os sinais você mesmo:" />
        ) : null}
      </div>

      {/* Sem o aceite da IA a lista fica à mão: quem está na dúvida de um golpe não precisa aceitar nada pra ler. */}
      {showConsent && !result && !error && (
        <ResultadoGolpe result={OFFLINE_CHECKLIST} note="Sem IA, dá pra conferir assim:" />
      )}
    </div>
  );
}
