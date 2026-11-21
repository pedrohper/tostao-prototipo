'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MissionsResponse } from '@tostao/contracts';
import { getDictionary, type Locale } from '@/lib/i18n';
import type { Lesson } from '@/lib/lessons';
import { dilemmaLead, dilemmaOptions } from '@/lib/lesson-dilemma';
import { canGoBack, previousStep } from '@/lib/lesson-steps';
import { personalizeHook, type LessonUserContext } from '@/lib/lesson-context';
import { playSound } from '@/lib/sons';
import { getStoryPageMeta } from '@/lib/story-cast';
import { XP_PER_LESSON } from '@/lib/xp';
import { markLessonDone } from '../actions';
import { Mascot, type MascotPose } from '@/components/mascote';
import { Selo } from '@/components/selo';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';
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
  initialMissions?: MissionsResponse | null;
  today: string;
  /** Números reais da pessoa (null = lição didática, como sempre foi). */
  userContext?: LessonUserContext | null;
};

const STEP_META: { pose: MascotPose; bg: string }[] = [
  { pose: 'investigando', bg: 'bg-amarelo-claro' },
  { pose: 'professor', bg: 'bg-papel' },
  { pose: 'pensando', bg: 'bg-azul' },
  { pose: 'pensando', bg: 'bg-rosa' },
  { pose: 'comemorando', bg: 'bg-papel' },
  { pose: 'orgulhoso', bg: 'bg-papel' },
];

const CHALLENGE_ROUTES: Record<string, string> = {
  'm1-l1': '/carteira?filtro=pendentes',
  'm1-l2': '/limites',
  'm1-l3': '/assinaturas',
  'm1-l4': '/carteira',
  'm1-l5': '/previsao',
  'm2-l2': '/carteira',
  'm4-l1': '/meta',
  'm4-l4': '/meta',
  'm4-l5': '/meta',
  'm5-l5': '/meta',
  'm7-l4': '/investir',
  'm7-l5': '/carteira',
  'm9-l2': '/carteira',
};

function buildWeekDays(today: string, week?: MissionsResponse['week']) {
  if (week && week.length === 7) {
    return week.map((d) => ({ day: d.day, done: d.day === today ? Math.max(1, d.done) : d.done }));
  }
  const anchor = new Date(`${today}T12:00:00Z`);
  const dow = anchor.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor.getTime() + (mondayOffset + i) * 86_400_000).toISOString().slice(0, 10);
    return { day: d, done: d === today ? 1 : 0 };
  });
}

export function LessonPlayer({
  lesson,
  moduleTitle,
  moduleNumber,
  nextId,
  pageAsset = null,
  slideAsset = null,
  locale,
  initialMissions = null,
  today,
  userContext = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const dict = getDictionary(locale);
  const t = dict.pages.learnExtra;
  const tl = dict.growth.learn;
  const [step, setStep] = useState(0);
  const [vote, setVote] = useState<'A' | 'B' | null>(null);
  const [missions, setMissions] = useState<MissionsResponse | null>(initialMissions);
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const s = STEP_META[step]!;
  const storyMeta = getStoryPageMeta(lesson.id);
  const headerPose: MascotPose = step <= 1 ? storyMeta.poses[0] : s.pose;
  const stepLabel = t.steps[step] ?? '';
  const Sim = SIMULATORS[lesson.id];
  const isCompletion = step === 4;
  const isChallenge = step === 5;
  const isEndFlow = isCompletion || isChallenge;
  const hook = personalizeHook(lesson.id, userContext, lesson.hook);
  const dilemma = dilemmaOptions(lesson.dilemma);
  const dilemmaIntro = dilemmaLead(lesson.dilemma.question);
  const cleanCommitment = lesson.commitment.replace(/\s*---\s*$/, '').trim();
  const challengeRoute = CHALLENGE_ROUTES[lesson.id];

  const optimisticStreak = missions
    ? Math.max(1, missions.todayKept ? missions.streakDays : missions.streakDays + 1)
    : 1;
  const weekDays = buildWeekDays(today, missions?.week);

  const advance = () => {
    if (step === 3) {
      playSound('festa');
      markLessonDone(lesson.id)
        .then((updated) => {
          if (updated) setMissions(updated);
        })
        // Sem isto a falha (API fora, sessão) sumia em silêncio e a pessoa achava que o XP tinha sido dado.
        .catch(() => toast.error(dict.system.actionFailed));
    }
    setStep(step + 1);
  };

  const handleAcceptChallenge = () => {
    try {
      const key = 'tostao-desafios-aceitos';
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, string>;
      saved[lesson.id] = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      // Armazenamento bloqueado (aba anônima, cota cheia): o desafio segue, mas a pessoa sabe que não ficou salvo.
      toast.error(dict.system.actionFailed);
    }
    playSound('missao');
    setChallengeAccepted(true);
    if (challengeRoute) {
      router.push(challengeRoute);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[680px] md:my-6 md:min-h-0 md:rounded-[28px] md:border md:border-linha md:bg-cartao md:p-6 md:pb-8">
      <div
        className={`-mx-5 -mt-6 -mb-28 flex min-h-dvh flex-col gap-4 px-5 pt-6 pb-28 md:mx-0 md:mt-0 md:mb-0 md:min-h-0 md:rounded-[20px] md:p-5 ${isEndFlow ? 'md:p-7' : ''} ${s.bg}`}
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

        {!isEndFlow && (
          <>
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
          </>
        )}

        <div className="flex flex-1 flex-col gap-3 text-[16px] leading-relaxed">
          {step === 0 && (
            <div className="flex flex-col gap-3">
              {pageAsset && (
                <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[20px] border border-linha bg-cartao">
                  <img src={pageAsset} alt={lesson.title} className="aspect-[3/4] w-full object-cover" />
                </div>
              )}
              <p className="rounded-[20px] bg-cartao p-4 font-display text-xl leading-snug font-bold">
                {hook.personalized && (
                  <span className="mb-2 flex w-fit items-center gap-1 rounded-full bg-menta-clara px-2.5 py-0.5 font-sans text-[11px] font-bold tracking-wider text-verde-texto uppercase">
                    <Selo tipo="dados" className="mr-0" />
                    {tl.yourStatement}
                  </span>
                )}
                “{hook.text}”
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              {slideAsset && (
                <div className="mx-auto w-full max-w-[480px] overflow-hidden rounded-[20px] border border-linha bg-cartao">
                  <img src={slideAsset} alt={lesson.title} className="aspect-[4/3] w-full object-cover" />
                </div>
              )}
              <p className="rounded-[20px] bg-cartao p-4">{lesson.concept}</p>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-3 rounded-[20px] bg-cartao p-4">
              <span className="font-display text-lg font-extrabold">{lesson.simulator.name}</span>
              {Sim ? (
                <Sim locale={locale} userContext={userContext} />
              ) : (
                // Toda lição tem simulador (simulators.spec garante); este é só o seguro contra um id novo sem simulador.
                <p className="text-[15px]">
                  {lesson.simulator.description.charAt(0).toUpperCase() + lesson.simulator.description.slice(1)}
                </p>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <p className="rounded-[20px] bg-cartao p-4 font-semibold">{dilemmaIntro ?? tl.dilemmaAsk}</p>
              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ['A', dilemma.a || t.optionLabel('A')],
                    ['B', dilemma.b || t.optionLabel('B')],
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
                    <span className="text-[15px] leading-snug font-semibold text-tinta">{text}</span>
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
          {isCompletion && (
            <div className="flex flex-1 flex-col justify-center gap-5 py-2">
              <Confetti />
              <div className="flex justify-center">
                <Mascot pose="comemorando" size={196} alt="Tostão comemorando" />
              </div>
              <div className="flex flex-col items-center gap-2.5 text-center">
                <h1 className="font-display text-[32px] leading-[36px] font-extrabold text-tinta">
                  {t.lessonDoneTitle}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full bg-amarelo px-3 py-1 text-[14px] font-bold text-tinta-fixa">
                    +{XP_PER_LESSON} XP
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-papel-2 px-3 py-1 text-[14px] font-bold text-tinta">
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="#FF5A36"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                    {t.lessonDoneStreakDays(optimisticStreak)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 rounded-[18px] border border-linha bg-cartao p-4 text-center text-xs font-semibold text-tinta-suave">
                {weekDays.map((dayItem, idx) => {
                  const isDone = dayItem.done > 0;
                  const isToday = dayItem.day === today;
                  return (
                    <div
                      key={dayItem.day}
                      className={`flex flex-col items-center gap-1.5 ${isToday ? 'font-bold text-tinta' : ''}`}
                    >
                      <span
                        className={`h-7 w-7 rounded-full ${
                          isDone ? 'bg-laranja' : 'box-border border-[1.5px] border-linha'
                        } ${isToday ? 'ring-2 ring-tinta ring-offset-2 ring-offset-papel' : ''}`}
                      />
                      <span>{dict.weekdaysShort[idx]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {isChallenge && (
            <div className="flex flex-1 flex-col justify-center gap-5 py-2">
              <div className="flex justify-center">
                <Mascot pose="orgulhoso" size={144} alt="Tostão" />
              </div>
              <div className="flex flex-col gap-2 rounded-[22px] bg-menta-clara p-5 text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold tracking-[0.08em] text-tinta uppercase">
                    {t.weeklyChallengeEyebrow}
                  </span>
                  {challengeAccepted && (
                    <span className="rounded-full bg-cartao/85 px-2.5 py-0.5 text-[11px] font-bold text-verde-texto">
                      {t.challengeAcceptedBadge}
                    </span>
                  )}
                </div>
                <p className="font-display text-[22px] leading-[28px] font-bold text-tinta">{cleanCommitment}</p>
                <p className="text-sm leading-5 text-tinta/85">
                  {challengeAccepted ? t.challengeAcceptedHint : t.weeklyChallengeHint}
                </p>
              </div>
            </div>
          )}
        </div>

        {isCompletion ? (
          <div className="flex flex-col gap-2 pt-1">
            <Button variant="laranja" onClick={() => setStep(5)}>
              {t.seeWeeklyChallenge}
            </Button>
            <Link
              href="/inicio"
              className="flex h-10 items-center justify-center text-sm font-semibold text-tinta-suave no-underline transition-colors hover:text-tinta"
            >
              {t.backToHome}
            </Link>
          </div>
        ) : isChallenge ? (
          <div className="flex flex-col gap-2 pt-1">
            {!challengeAccepted ? (
              <>
                <Button variant="laranja" onClick={handleAcceptChallenge}>
                  {t.acceptChallenge}
                </Button>
                <Link
                  href="/inicio"
                  className="flex h-10 items-center justify-center text-sm font-semibold text-tinta-suave no-underline transition-colors hover:text-tinta"
                >
                  {t.declineChallengeToHome}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={nextId ? `/aprender/${nextId}` : '/aprender'}
                  className="flex h-[54px] items-center justify-center rounded-full bg-tinta font-semibold text-papel no-underline"
                >
                  {nextId ? t.nextLesson : t.backToLearn}
                </Link>
                <Link
                  href="/inicio"
                  className="flex h-10 items-center justify-center text-sm font-semibold text-tinta-suave no-underline transition-colors hover:text-tinta"
                >
                  {t.backToHome}
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Button variant="dark" onClick={advance} disabled={step === 3 && !vote}>
              {step === 3 && !vote ? t.chooseSide : t.continueCta}
            </Button>
            {canGoBack(step) && (
              <button
                type="button"
                onClick={() => setStep(previousStep(step))}
                aria-label={tl.backAria}
                className="flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-semibold text-tinta-suave transition-colors hover:text-tinta"
              >
                <span aria-hidden="true">←</span>
                {tl.back}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
