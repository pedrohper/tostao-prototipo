'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { TribunalResponse } from '@tostao/contracts';
import { ErrorNote } from '@/components/ui';
import { voteTribunal } from './actions';

/** "**negrito**" → <b>. Os casos vêm da API com esse marcador simples. */
export function Rich({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>;
}

const BAR = ['bg-menta-clara', 'bg-azul', 'bg-amarelo-claro', 'bg-rosa'];

export function Voto({ initial }: { initial: TribunalResponse }) {
  const [t, setT] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const total = t.votes?.reduce((a, b) => a + b, 0) ?? 0;
  function pick(i: number) {
    start(async () => {
      const r = await voteTribunal(t.case.id, i);
      if (r.result) { setT(r.result); setError(undefined); } else setError(r.error);
    });
  }
  return (
    <>
      <span className="text-[15px] font-bold">{t.case.question}</span>
      <div className="flex flex-col gap-2.5" aria-busy={pending}>
        {t.case.options.map((label, i) => {
          const pct = t.votes && total ? Math.round(((t.votes[i] ?? 0) / total) * 100) : 0;
          const mine = t.myVote === i;
          return (
            <button key={label} type="button" onClick={() => pick(i)} disabled={pending} aria-pressed={mine}
              className={`relative flex min-h-[54px] items-center overflow-hidden rounded-[14px] bg-cartao px-[18px] text-left text-base font-semibold text-tinta ${mine ? 'border-2 border-tinta' : 'border-[1.5px] border-linha'}`}>
              <span className={`bar-fill absolute inset-y-0 left-0 ${BAR[i % BAR.length]}`} style={{ width: `${t.votes ? pct : 0}%` }} aria-hidden="true" />
              <span className="relative flex w-full justify-between gap-2"><span>{label}</span>{t.votes && <span className="tabular-nums">{pct}%</span>}</span>
            </button>
          );
        })}
      </div>
      <ErrorNote message={error} />
      {t.verdict ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-rosa px-3.5 py-3 text-[#1E1B18]">
          <span className="text-[13px] font-bold">{t.verdict.title}</span>
          <p className="text-sm leading-5"><Rich text={t.verdict.text} /></p>
        </div>
      ) : (
        <div className="rounded-2xl bg-papel-2 px-3.5 py-3 text-sm leading-5 text-tinta-suave">Vota primeiro. Depois eu mostro a conta dos dois lados e o que o resto da galera escolheu.</div>
      )}
      <div className="grow" />
      {t.myVote !== null && (
        <Link href="/aprender" className="flex h-[54px] shrink-0 items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel no-underline">+20 XP garantido. Voltar</Link>
      )}
    </>
  );
}
