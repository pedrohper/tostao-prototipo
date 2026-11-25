// A próxima lição: cartão do celular e cartão da coluna da direita no computador.
import Link from 'next/link';
import { Mascot } from '@/components/mascote';
import { getI18n } from '@/lib/i18n-server';
import { modules } from '@/lib/lessons';
import { getHomeProgress } from './dados';

async function currentLesson() {
  const { done } = await getHomeProgress();
  const current = modules.find((m) => m.lessons.some((l) => !done.includes(l.id))) ?? null;
  const next = current?.lessons.find((l) => !done.includes(l.id));
  return {
    done,
    current,
    next,
    completed: current ? current.lessons.filter((l) => done.includes(l.id)).length : 0,
    href: next ? `/aprender/${next.id}` : '/aprender/trilha',
  };
}

export async function LessonCard() {
  const [{ t }, { done, current, next, completed, href }] = await Promise.all([getI18n(), currentLesson()]);
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3.5 pr-4 text-tinta no-underline"
    >
      <Mascot pose="professor" size={84} alt="Tostão" className="shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-xs font-semibold text-tinta-suave">
          {current
            ? t.home.learnModuleProgress(current.number, completed, current.lessons.length)
            : t.home.allModulesCompleted}
        </span>
        <span className="font-display text-[18px] leading-[22px] font-extrabold">
          {next?.title ?? current?.title ?? t.home.allModulesCompleted}
        </span>
        {current && (
          <span className="flex gap-1" aria-hidden="true">
            {current.lessons.map((lesson) => (
              <i
                key={lesson.id}
                className={`h-1.5 flex-1 rounded-full ${done.includes(lesson.id) ? 'bg-tinta' : 'bg-cartao'}`}
              />
            ))}
          </span>
        )}
        <span className="text-small font-semibold">{t.nav.continueLesson} ›</span>
      </span>
    </Link>
  );
}

export async function LessonRailCard() {
  const [{ t }, { done, current, completed, href }] = await Promise.all([getI18n(), currentLesson()]);
  const progressLabel = current
    ? t.home.learnModuleProgress(current.number, completed, current.lessons.length)
    : t.home.allModulesCompleted;
  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-amarelo-claro p-4">
      <Mascot pose="professor" size={96} alt="Tostão" />
      <span className="text-xs font-semibold text-tinta-suave">{progressLabel}</span>
      <span className="font-display text-title leading-[26px] font-extrabold text-tinta">
        {current?.title ?? t.home.allModulesCompleted}
      </span>
      {current && (
        <div className="flex gap-[5px]" role="img" aria-label={progressLabel}>
          {current.lessons.map((lesson) => (
            <i
              key={lesson.id}
              className={`h-2 flex-1 rounded-full ${done.includes(lesson.id) ? 'bg-tinta' : 'bg-cartao'}`}
            />
          ))}
        </div>
      )}
      <Link
        href={href}
        className="flex h-11 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel no-underline"
      >
        {t.nav.continueLesson}
      </Link>
    </div>
  );
}
