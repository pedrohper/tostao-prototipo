import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SimulatorView } from '@/components/simulator-view';
import { getI18n } from '@/lib/i18n-server';
import { findLesson } from '@/lib/lessons';
import { loadLessonContext } from '@/lib/lesson-context-server';
import { findSimulator } from '@/lib/simulators-catalog';

// Um simulador isolado (T4.5). Só abre os que estão na galeria: o id da URL nunca vira "qualquer lição".
export default async function SimuladorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = findSimulator(id);
  if (!entry) notFound();
  const [{ locale, t }, userContext] = await Promise.all([getI18n(), loadLessonContext(id)]);
  const tl = t.growth.learn;
  const lesson = findLesson(id);
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
      <Link
        href="/aprender/simuladores"
        className="w-fit text-sm font-semibold text-tinta-suave no-underline hover:text-tinta"
      >
        ← {tl.simulatorsBack}
      </Link>
      <div className="flex flex-col gap-1">
        {lesson && (
          <span className="text-[11px] font-bold tracking-[0.08em] text-tinta-suave uppercase">
            {tl.simulatorLesson(lesson.module.number, lesson.lesson.number)}
          </span>
        )}
        <h1 className="font-display text-[26px] leading-[30px] font-extrabold">{entry.title}</h1>
        <p className="text-[15px] leading-[21px] text-tinta-suave">{entry.blurb}</p>
      </div>
      <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4 text-[16px] leading-relaxed">
        <SimulatorView id={id} locale={locale} userContext={userContext} />
      </div>
      <Link
        href={`/aprender/${id}`}
        className="flex h-11 items-center justify-center rounded-full border border-linha bg-cartao text-sm font-semibold text-tinta no-underline transition-colors hover:bg-papel-2"
      >
        {tl.simulatorOpenLesson}
      </Link>
    </div>
  );
}
