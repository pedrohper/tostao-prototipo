'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Lesson } from '@/lib/lessons';
import { markLessonDone } from '../actions';
import { Mascote, type Pose } from '@/components/mascote';
import { Button } from '@/components/ui';
import { Confete } from '@/components/confete';
import { SIMULATORS } from './simulators';

type Props = { lesson: Lesson; moduleTitle: string; moduleNumber: number; nextId: string | null };

const STEPS: { label: string; pose: Pose; bg: string }[] = [
  { label: 'Seu extrato', pose: 'investigando', bg: 'bg-amarelo-claro' },
  { label: 'A ideia', pose: 'professor', bg: 'bg-papel' },
  { label: 'Brinca com o número', pose: 'pensando', bg: 'bg-azul' },
  { label: 'Dilema', pose: 'pensando', bg: 'bg-rosa' },
  { label: 'Compromisso da semana', pose: 'orgulhoso', bg: 'bg-menta-clara' },
  { label: 'Fechou!', pose: 'comemorando', bg: 'bg-amarelo' },
];

export function LessonPlayer({ lesson, moduleTitle, moduleNumber, nextId }: Props) {
  const [step, setStep] = useState(0);
  const [vote, setVote] = useState<'A' | 'B' | null>(null);
  const s = STEPS[step];
  const Sim = SIMULATORS[lesson.id];
  const last = step === STEPS.length - 1;

  const advance = () => {
    if (step === STEPS.length - 2) void markLessonDone(lesson.id);
    setStep(step + 1);
  };

  return (
    <div className={`-mx-5 -mt-12 flex min-h-[calc(100dvh-90px)] flex-col gap-4 px-5 pt-10 pb-6 md:-mx-8 md:rounded-b-3xl md:px-8 ${s.bg}`}>
      <div className="flex items-center gap-3">
        <Link href="/aprender" aria-label="Sair da lição" className="text-2xl leading-none">×</Link>
        <div className="flex flex-1 gap-1.5" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-laranja' : 'bg-tinta/10'}`} />)}
        </div>
      </div>
      <span className="text-xs font-bold tracking-wider text-laranja-texto uppercase">Módulo {moduleNumber} · {moduleTitle}</span>
      <div className="flex items-center gap-3">
        <Mascote pose={s.pose} size={84} alt="" />
        <div>
          <span className="text-sm font-semibold text-tinta-suave">{s.label}</span>
          <h1 className="font-display text-[24px] leading-tight font-extrabold">{lesson.title}</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 text-[16px] leading-relaxed">
        {step === 0 && <p className="rounded-[20px] bg-cartao p-4 font-display text-xl leading-snug font-bold">“{lesson.hook}”</p>}
        {step === 1 && <p className="rounded-[20px] bg-cartao p-4">{lesson.concept}</p>}
        {step === 2 && (
          <div className="flex flex-col gap-3 rounded-[20px] bg-cartao p-4">
            <span className="font-display text-lg font-extrabold">{lesson.simulator.name}</span>
            {Sim ? <Sim /> : (
              <>
                <p className="text-[15px]">{lesson.simulator.description.charAt(0).toUpperCase() + lesson.simulator.description.slice(1)}</p>
                <p className="rounded-xl bg-papel-2 p-3 text-sm text-tinta-suave">🚧 Esse simulador ainda tá no papel. Por enquanto, imagina a conta com os seus números.</p>
              </>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className="rounded-[20px] bg-cartao p-4 font-semibold">{lesson.dilemma.question}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {(['A', 'B'] as const).map((side) => (
                <button key={side} type="button" onClick={() => setVote(side)}
                  className={`rounded-2xl border-2 p-3 text-left text-[15px] font-semibold ${vote === side ? 'border-tinta bg-cartao' : 'border-transparent bg-cartao/70'}`}>
                  {side === 'A' ? 'Primeira opção' : 'Segunda opção'}
                </button>
              ))}
            </div>
            {vote && (
              <div className="flex flex-col gap-2 rounded-[20px] bg-cartao p-4 text-[15px]">
                <p><b>A favor da primeira:</b> {lesson.dilemma.sideA}</p>
                <p><b>A favor da segunda:</b> {lesson.dilemma.sideB}</p>
                <p className="text-tinta-suave">Não tem resposta única. Depende do seu momento, e tá tudo bem.</p>
              </div>
            )}
          </div>
        )}
        {step === 4 && <p className="rounded-[20px] bg-cartao p-4 font-semibold">{lesson.commitment}</p>}
        {step === 5 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Confete />
            <p className="mascote-pula font-display text-[34px] font-extrabold">+20 XP</p>
            <p className="text-[15px]">Lição feita. O Caramelo já tá de olho no seu extrato pra conferir o compromisso.</p>
          </div>
        )}
      </div>

      {last ? (
        <div className="flex flex-col gap-2.5">
          {nextId && <Link href={`/aprender/${nextId}`} className="flex h-[54px] items-center justify-center rounded-full bg-tinta font-semibold text-papel no-underline">Próxima lição</Link>}
          <Link href="/aprender" className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta font-semibold no-underline">Voltar pro Aprender</Link>
        </div>
      ) : (
        <Button variant={step === 4 ? 'laranja' : 'dark'} onClick={advance} disabled={step === 3 && !vote}>
          {step === 4 ? 'Topo o desafio' : step === 3 && !vote ? 'Escolhe um lado' : 'Continuar'}
        </Button>
      )}
    </div>
  );
}
