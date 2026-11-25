// Home vazia (sem lançamento nem saldo): em vez de esconder tudo, mostra os primeiros passos e MANTÉM o que a pessoa já
// preencheu (renda/previsão, meta e aula), pra o plano que ela acabou de montar aparecer na hora.
import Link from 'next/link';
import type { MonthSummaryResponse, ProfileResponse } from '@tostao/contracts';
import { Mascot } from '@/components/mascote';
import { ButtonLink, Card } from '@/components/ui';
import { getI18n } from '@/lib/i18n-server';
import { modules } from '@/lib/lessons';
import { activationChecklist } from '@/lib/onboarding';
import { LessonCard } from './aula';
import { getForecast, getHomeProgress } from './dados';
import { GoalsSection, LeftoverSection, goalsOf } from './previsao';

export const isEmptyHome = (summary: MonthSummaryResponse) =>
  summary.balanceInCents === null && summary.outcomeInCents === 0 && summary.incomeInCents === 0;

export async function EmptyHome({ profile }: { profile: ProfileResponse }) {
  const [{ t }, forecast, progress] = await Promise.all([getI18n(), getForecast(), getHomeProgress()]);
  const goals = goalsOf(forecast);
  const nextLesson = modules.flatMap((m) => m.lessons).find((l) => !progress.done.includes(l.id));
  const firstLessonHref = nextLesson ? `/aprender/${nextLesson.id}` : '/aprender';
  const checklist = activationChecklist({
    hasConnection: profile.connections.length > 0,
    hasTransactions: false, // só chega aqui sem lançamento nem saldo
    hasGoal: goals.length > 0,
    lessonsDone: progress.done.length,
    firstLessonHref,
  });
  const fs = t.growth.firstSteps;
  const showPlan = Boolean(forecast?.hasPlan) || goals.length > 0 || progress.done.length > 0;
  return (
    <>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Mascot pose="dormindo" size={96} alt="Tostão" className="shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-title leading-[26px] font-extrabold">{fs.title}</h2>
            <p className="text-[14px] leading-[20px] text-tinta-suave">{fs.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label={fs.progress(checklist.doneCount, checklist.total)}
            aria-valuemin={0}
            aria-valuemax={checklist.total}
            aria-valuenow={checklist.doneCount}
            className="h-2 overflow-hidden rounded-full bg-papel-2"
          >
            <div
              className="h-full rounded-full bg-menta transition-all"
              style={{ width: `${(checklist.doneCount / checklist.total) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-tinta-suave">
            {fs.progress(checklist.doneCount, checklist.total)}
          </span>
        </div>
        <ol className="flex flex-col gap-2">
          {checklist.items.map((item, index) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl border border-linha p-3 text-tinta no-underline transition-colors hover:bg-papel-2 ${
                  item.done ? 'bg-menta-clara' : 'bg-cartao'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    item.done ? 'bg-menta text-tinta-fixa' : 'bg-papel-2 text-tinta-suave'
                  }`}
                >
                  {item.done ? '✓' : index + 1}
                </span>
                <span className="flex min-w-0 grow flex-col">
                  <span className={`text-body font-bold ${item.done ? 'line-through decoration-1 opacity-70' : ''}`}>
                    {fs.items[item.id].title}
                  </span>
                  <span className="text-small leading-[18px] text-tinta-suave">{fs.items[item.id].desc}</span>
                </span>
                {item.done ? (
                  <span className="shrink-0 text-xs font-bold text-verde-texto">{fs.doneTag}</span>
                ) : (
                  <span className="shrink-0 text-tinta-suave" aria-hidden="true">
                    ›
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex-1">
            <ButtonLink href="/anotar" variant="laranja">
              {fs.tryFirstExpense}
            </ButtonLink>
          </div>
          <div className="flex-1">
            <ButtonLink href={firstLessonHref} variant="outline">
              {fs.exploreLesson}
            </ButtonLink>
          </div>
        </div>
      </Card>
      {showPlan && (
        <div className="flex flex-col gap-4">
          {forecast?.hasPlan && <LeftoverSection />}
          {goals.length > 0 && <GoalsSection />}
          {progress.done.length > 0 && <LessonCard />}
        </div>
      )}
    </>
  );
}
