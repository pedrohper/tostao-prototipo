import Link from 'next/link';

import { Icon } from '@/components/icone';
import { BackLink, PageFrame } from '@/components/ui';

import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import { getMissions, getProgress } from '@/lib/api-queries';

export default async function OfensivaPage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const [{ locale, t }, sp, progress, missions] = await Promise.all([
    getI18n(),
    searchParams ?? Promise.resolve<{ voltar?: string }>({}),
    getProgress().catch(() => NO_PROGRESS),
    getMissions().catch(() => null),
  ]);

  const backHref = resolveBackHref(sp.voltar, '/inicio');
  const streakDays = missions?.streakDays ?? progress.streakDays;
  const { xp, level } = xpFrom(progress.done.length, progress.bonusXp ?? 0);
  const xpRemaining = level * 100 - xp;
  const completedCount = missions?.missions.filter((m) => m.done).length ?? 0;
  const totalCount = missions?.missions.length ?? 0;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const sequenceLabel =
    locale === 'en' ? '7-day sequence' : locale === 'es' ? 'Secuencia de 7 días' : 'Sequência de 7 dias';

  return (
    <PageFrame size="focused">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <BackLink href={backHref} label={t.common.back} />
          <h1 className="truncate font-display text-[24px] leading-[30px] font-extrabold text-tinta">
            {t.nav.streakDays(streakDays)}
          </h1>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amarelo px-3 py-1.5 text-xs font-bold text-tinta-fixa">
          <Icon src="ui/xp" size={16} />
          {xp} XP
        </span>
      </div>

      <section className="flex flex-col gap-3 rounded-[22px] bg-amarelo-claro p-5 text-tinta">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cartao">
            <Icon src="ui/ofensiva" size={28} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-2xl leading-7 font-extrabold">{t.nav.streakDays(streakDays)}</span>
            <span className="text-[13px] text-tinta-suave">
              {missions?.todayKept ? t.engagement.streakKeptHint : t.engagement.oneMissionHint}
            </span>
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-cartao">
          <div className="h-full rounded-full bg-tinta" style={{ width: `${Math.max(4, xp % 100)}%` }} />
        </div>
        <span className="text-xs font-medium text-tinta-suave">{t.nav.xpToNextLevel(xpRemaining, level + 1)}</span>
      </section>

      {missions && missions.week.length > 0 && (
        <section className="flex flex-col gap-3 rounded-[22px] border border-linha bg-cartao p-5">
          <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{sequenceLabel}</span>
          <div className="flex items-center justify-between gap-1.5" role="img">
            {missions.week.map((dayItem, idx) => {
              const active = dayItem.done > 0;
              return (
                <span
                  key={dayItem.day}
                  className="flex flex-col items-center gap-1.5 text-[11px] font-semibold text-tinta-suave"
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                      active
                        ? 'border-laranja/30 bg-laranja text-tinta-fixa'
                        : 'border-dashed border-linha bg-papel-2 text-tinta-suave'
                    }`}
                  >
                    {active ? <Icon src="ui/ofensiva" size={18} /> : <span className="text-[11px]">·</span>}
                  </span>
                  <span className={active ? 'font-bold text-tinta' : ''}>{t.weekdaysShort[idx]}</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      {missions && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
              {t.engagement.todayMissionsLabel(completedCount, totalCount).replace(/\s*›$/, '')}
            </span>
            {allDone && (
              <span className="rounded-full bg-menta-clara px-2.5 py-0.5 text-[11px] font-bold text-verde-texto">
                {t.engagement.allDoneTitle}
              </span>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-4">
            {missions.missions.map((mission) => (
              <li key={mission.id}>
                <Link
                  href={mission.href}
                  className="flex min-h-[58px] items-center gap-3 py-3 text-tinta no-underline transition-opacity hover:opacity-80"
                >
                  {mission.done ? (
                    <Icon src="jogo/dia-cumprido" size={24} alt="done" />
                  ) : (
                    <span
                      aria-label="todo"
                      className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-tinta-suave"
                    />
                  )}
                  <span
                    className={`grow text-[15px] ${mission.done ? 'text-tinta-suave line-through' : 'font-semibold'}`}
                  >
                    {mission.title}
                  </span>
                  {!mission.done && (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="shrink-0 text-tinta-suave"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageFrame>
  );
}
