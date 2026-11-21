import Link from 'next/link';
import { Mascot } from '@/components/mascote';
import { getI18n } from '@/lib/i18n-server';
import { findLesson } from '@/lib/lessons';
import { simulatorsByGroup } from '@/lib/simulators-catalog';

// Galeria de simuladores (T4.5): os principais, a qualquer hora, sem precisar abrir uma lição.
export default async function SimuladoresPage() {
  const { t } = await getI18n();
  const tl = t.growth.learn;
  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href="/aprender" className="w-fit text-sm font-semibold text-tinta-suave no-underline hover:text-tinta">
          ← {t.learn.title}
        </Link>
        <div className="flex items-center gap-3">
          <Mascot pose="professor" size={72} alt="" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-[26px] leading-[30px] font-extrabold lg:text-[30px]">
              {tl.simulatorsTitle}
            </h1>
            <p className="text-[15px] leading-[21px] text-tinta-suave">{tl.simulatorsSub}</p>
          </div>
        </div>
      </header>

      {simulatorsByGroup().map(({ group, items }) => (
        <section key={group} className="flex flex-col gap-2.5" aria-label={group}>
          <h2 className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{group}</h2>
          <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((s) => {
              const lesson = findLesson(s.id);
              return (
                <li key={s.id} className="min-w-0">
                  <Link
                    href={`/aprender/simuladores/${s.id}`}
                    className="flex h-full flex-col gap-1.5 rounded-[18px] border border-linha bg-cartao p-4 text-tinta no-underline transition-colors hover:bg-papel-2"
                  >
                    {lesson && (
                      <span className="text-[11px] font-bold tracking-[0.08em] text-tinta-suave uppercase">
                        {tl.simulatorLesson(lesson.module.number, lesson.lesson.number)}
                      </span>
                    )}
                    <span className="font-display text-[18px] leading-[22px] font-extrabold">{s.title}</span>
                    <span className="text-[13px] leading-[19px] text-tinta-suave">{s.blurb}</span>
                    <span className="mt-auto pt-1 text-[13px] font-semibold text-laranja-texto">
                      {tl.simulatorOpen} →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
