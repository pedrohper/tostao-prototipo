'use client';
import { Icon } from '@/components/icone';
import Link from 'next/link';
import { useState } from 'react';
import { getDictionary, type Locale } from '@/lib/i18n';
import type { Lesson } from '@/lib/lessons';
import { getStoryPageMeta } from '@/lib/story-cast';
import { markLessonDone } from '../actions';
import { Mascot, type MascotPose } from '@/components/mascote';
import { Button } from '@/components/ui';
import { Confetti } from '@/components/confete';
import { SIMULATORS } from './simulators';

type Props = {
  lesson: Lesson;
  moduleTitle: string;
  moduleNumber: number;
  nextId: string | null;
  pageAsset?: string | null;
  slideAsset?: string | null;
  locale: Locale;
};

const STEP_META: { pose: MascotPose; bg: string }[] = [
  { pose: 'investigando', bg: 'bg-amarelo-claro' },
  { pose: 'professor', bg: 'bg-papel' },
  { pose: 'pensando', bg: 'bg-azul' },
  { pose: 'pensando', bg: 'bg-rosa' },
  { pose: 'orgulhoso', bg: 'bg-menta-clara' },
  { pose: 'comemorando', bg: 'bg-amarelo' },
];

export function LessonPlayer({
  lesson,
  moduleTitle,
  moduleNumber,
  nextId,
  pageAsset = null,
  slideAsset = null,
  locale,
}: Props) {
  const t = getDictionary(locale).pages.learnExtra;
  const [step, setStep] = useState(0);
  const [vote, setVote] = useState<'A' | 'B' | null>(null);
  const s = STEP_META[step]!;
  const storyMeta = getStoryPageMeta(lesson.id);
  const headerPose: MascotPose = step <= 1 ? storyMeta.poses[0] : s.pose;
  const stepLabel = t.steps[step] ?? '';
  const Sim = SIMULATORS[lesson.id];
  const last = step === STEP_META.length - 1;

  const advance = () => {
    if (step === STEP_META.length - 2) void markLessonDone(lesson.id);
    setStep(step + 1);
  };

  return (
    <div className="mx-auto w-full max-w-[680px] md:my-6 md:min-h-0 md:rounded-[28px] md:border md:border-linha md:bg-cartao md:p-6 md:pb-8">
      <div
        className={`-mx-5 -mt-6 -mb-28 flex min-h-dvh flex-col gap-4 px-5 pt-6 pb-28 md:mx-0 md:mt-0 md:mb-0 md:min-h-0 md:rounded-[20px] md:p-5 ${s.bg}`}
      >
        <div className="flex items-center gap-3">
          <Link href="/aprender" aria-label={t.exitLessonAria} className="text-2xl leading-none">
            ×
          </Link>
          <div className="flex flex-1 gap-1.5" aria-label={t.stepAria(step + 1, STEP_META.length)}>
            {STEP_META.map((_, i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? 'bg-laranja' : 'bg-tinta/10'}`} />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-laranja-texto uppercase">
            {t.modulePrefix(moduleNumber, moduleTitle)}
          </span>
          <span className="rounded-full bg-cartao/80 px-2.5 py-0.5 text-[11px] font-bold text-tinta">
            {t.hub.speakers[storyMeta.speaker]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Mascot pose={headerPose} size={84} alt="" />
          <div>
            <span className="text-sm font-semibold text-tinta-suave">{stepLabel}</span>
            <h1 className="font-display text-[24px] leading-tight font-extrabold">{lesson.title}</h1>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 text-[16px] leading-relaxed">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              {pageAsset && (
                <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[20px] border border-linha bg-cartao">
                  <img src={pageAsset} alt={lesson.title} className="aspect-[3/4] w-full object-cover" />
                </div>
              )}
              <p className="rounded-[20px] bg-cartao p-4 font-display text-xl leading-snug font-bold">
                “{lesson.hook}”
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              {slideAsset && (
                <div className="overflow-hidden rounded-[20px] border border-linha bg-cartao">
                  <img src={slideAsset} alt={lesson.title} className="max-h-[260px] w-full object-contain" />
                </div>
              )}
              <p className="rounded-[20px] bg-cartao p-4">{lesson.concept}</p>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-3 rounded-[20px] bg-cartao p-4">
              <span className="font-display text-lg font-extrabold">{lesson.simulator.name}</span>
              {Sim ? (
                <Sim locale={locale} />
              ) : (
                <>
                  <p className="text-[15px]">
                    {lesson.simulator.description.charAt(0).toUpperCase() + lesson.simulator.description.slice(1)}
                  </p>
                  <p className="flex items-center gap-2 rounded-xl bg-papel-2 p-3 text-sm text-tinta-suave">
                    <Icon src="ui/em-construcao" size={28} />
                    {t.simulatorWip}
                  </p>
                </>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <p className="rounded-[20px] bg-cartao p-4 font-semibold">{lesson.dilemma.question}</p>
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ['A', lesson.dilemma.optionA || t.optionLabel('A')],
                    ['B', lesson.dilemma.optionB || t.optionLabel('B')],
                  ] as const
                ).map(([side, text]) => (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setVote(side)}
                    className={`flex flex-col gap-1.5 rounded-2xl border-2 p-3.5 text-left transition ${
                      vote === side
                        ? 'border-tinta bg-cartao shadow-sm'
                        : 'border-transparent bg-cartao/70 hover:bg-cartao'
                    }`}
                  >
                    <span
                      className={`self-start rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase ${
                        vote === side ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta-suave'
                      }`}
                    >
                      {t.optionLabel(side)}
                    </span>
                    <span className="text-[15px] font-semibold text-tinta leading-snug">{text}</span>
                  </button>
                ))}
              </div>
              {vote && (
                <div className="flex flex-col gap-2 rounded-[20px] bg-cartao p-4 text-[15px]">
                  <p>
                    <b>{t.sideAFor}</b> {lesson.dilemma.sideA}
                  </p>
                  <p>
                    <b>{t.sideBFor}</b> {lesson.dilemma.sideB}
                  </p>
                  <p className="text-tinta-suave">{t.dilemmaNote}</p>
                </div>
              )}
            </div>
          )}
          {step === 4 && <p className="rounded-[20px] bg-cartao p-4 font-semibold">{lesson.commitment}</p>}
          {step === 5 && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Confetti />
              <p className="mascote-pula font-display text-[34px] font-extrabold">+20 XP</p>
              <p className="text-[15px]">{t.lessonDoneToast}</p>
            </div>
          )}
        </div>

        {last ? (
          <div className="flex flex-col gap-2.5">
            {nextId && (
              <Link
                href={`/aprender/${nextId}`}
                className="flex h-[54px] items-center justify-center rounded-full bg-tinta font-semibold text-papel no-underline"
              >
                {t.nextLesson}
              </Link>
            )}
            <Link
              href="/aprender"
              className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta font-semibold no-underline"
            >
              {t.backToLearn}
            </Link>
          </div>
        ) : (
          <Button variant={step === 4 ? 'laranja' : 'dark'} onClick={advance} disabled={step === 3 && !vote}>
            {step === 4 ? t.acceptChallenge : step === 3 && !vote ? t.chooseSide : t.continueCta}
          </Button>
        )}
      </div>
    </div>
  );
}
