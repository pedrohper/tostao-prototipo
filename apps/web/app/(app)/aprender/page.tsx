import { MissionCompletionToast } from '@/components/sons';
import { Icon } from '@/components/icone';
import Link from 'next/link';
import { modules } from '@/lib/lessons';
import type { FriendsResponse, MissionsResponse } from '@tostao/contracts';
import { Mascot } from '@/components/mascote';
import { Eyebrow, StreakChip } from '@/components/ui';
import type { BattlesResponse, LessonProgressResponse, MonthSummaryResponse, TribunalResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, todayIso } from '@/lib/format';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import { DesktopSplitShell } from '@/components/lateral';
import { DailyMissions } from '@/components/engajamento';
import { getI18n } from '@/lib/i18n-server';
import { LegacyProgress } from './legacy-progress';

export default async function AprenderPage() {
  const [{ locale, t }, { done, streakDays, doneToday, bonusXp = 0 }, summary, tribunal, battles, missions, friends] = await Promise.all([
    getI18n(),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<MonthSummaryResponse>(`/summary?month=${currentMonth()}`).catch(() => null),
    api<TribunalResponse>('/tribunal').catch(() => null),
    api<BattlesResponse>('/battles').catch(() => null),
    api<MissionsResponse>('/missions').catch(() => null),
    api<FriendsResponse>('/friends').catch(() => null),
  ]);
  const th = t.pages.learnExtra.hub;
  const tig = battles?.tigrinho;
  const batalhaLinha = !tig
    ? th.battle30DaysNoBet
    : tig.status === 'ativa'
      ? th.battleDayOf(tig.day, tig.totalDays)
      : tig.status === 'vencida'
        ? battles?.urubu.status === 'vencida'
          ? th.battleTwoDefeated
          : th.battleNextUrubu
        : th.battleTryAgain;
  const battlePct = tig && tig.totalDays > 0 ? Math.min(100, Math.max(0, Math.round((tig.day / tig.totalDays) * 100))) : 0;
  const pendentes = summary?.uncategorizedCount ?? 0;
  const { xp } = xpFrom(done.length, bonusXp);
  // Módulo atual = o primeiro que ainda tem lição por fazer
  const atualIdx = modules.findIndex((m) => m.lessons.some((l) => !done.includes(l.id)));
  const atual = atualIdx >= 0 ? modules[atualIdx] : null;
  const proxima = atual?.lessons.find((l) => !done.includes(l.id));
  const feitas = atual ? atual.lessons.filter((l) => done.includes(l.id)).length : 0;
  const proximos = atualIdx >= 0 ? modules.slice(atualIdx + 1, atualIdx + 4) : [];

  const myRankIdx = friends ? friends.ranking.findIndex((p) => p.me) : -1;
  const friendsTitle =
    friends && friends.ranking.length > 1
      ? myRankIdx >= 0
        ? th.friendsRank(myRankIdx + 1, friends.ranking.length)
        : th.friendsCount(friends.ranking.length)
      : th.friendsCallSomeone;
  const friendsSubtitle = friends
    ? th.friendsSub(friends.challenge.title, friends.ranking.length)
    : th.friendsEmptySub;

  const rightRail = (
    <>
      {missions ? (
        <DailyMissions data={missions} compact locale={locale} />
      ) : (
        <section className="flex flex-col gap-2.5 rounded-[18px] border border-linha bg-cartao p-3.5">
          <Eyebrow>{th.todayMissions}</Eyebrow>
          <Missao feita={doneToday > 0} href={proxima ? `/aprender/${proxima.id}` : '/aprender/trilha'} doneSr={th.doneSr} pendingSr={th.pendingSr}>
            {th.doLesson}
          </Missao>
        </section>
      )}

      <Eyebrow className="mt-1.5">{t.learn.activeBattleLabel}</Eyebrow>
      <Link href="/batalha?voltar=/aprender" className="flex items-center gap-2 rounded-[18px] bg-amarelo-claro p-2.5 pr-3.5 pl-1.5 text-tinta no-underline">
        <Mascot
          pose={tig?.status === 'vencida' ? 'urubu-pix' : 'tigrinho'}
          size={72}
          alt={tig?.status === 'vencida' ? t.pages.batalha.urubuTitle : 'Tigrinho'}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[15px] font-bold">{tig?.status === 'vencida' ? t.pages.batalha.urubuTitle : th.battle30DaysNoBet}</span>
          <div className="h-2 rounded-full bg-cartao">
            <div className="bar-fill h-full rounded-full bg-menta" style={{ width: `${battlePct}%` }} />
          </div>
          <span className="text-xs text-tinta-suave">{batalhaLinha}</span>
        </div>
      </Link>

      <Eyebrow className="mt-1.5">{t.learn.weekTribunalLabel}</Eyebrow>
      <Link href="/tribunal?voltar=/aprender" className="flex flex-col gap-1.5 rounded-[22px] border border-linha bg-cartao p-3.5 text-tinta no-underline">
        <span className="text-base font-bold">{tribunal?.case.title ?? th.caseOfWeek}</span>
        <span className="text-[13px] leading-[19px] text-tinta-suave">
          {tribunal?.myVote != null ? t.learn.votedLabel : t.learn.voteXpHint}
        </span>
      </Link>
    </>
  );

  return (
    <DesktopSplitShell rightWidth={340} right={rightRail}>
      <LegacyProgress saved={done} />
      {missions && <MissionCompletionToast day={todayIso()} done={missions.missions.filter((m) => m.done).length} streak={missions.streakDays} locale={locale} />}
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-[34px] leading-[38px] font-extrabold lg:text-[40px] lg:leading-[44px]">{t.learn.title}</h1>
        <div className="flex gap-1.5 lg:hidden">
          <StreakChip days={missions?.streakDays ?? streakDays} label={t.nav.streakDays(missions?.streakDays ?? streakDays)} />
          <span className="flex items-center gap-1 rounded-full bg-amarelo px-2.5 py-1.5 text-sm font-bold text-tinta-fixa"><Icon src="ui/xp" size={18} />{xp} XP</span>
        </div>
        <Link href="/aprender/trilha" className="hidden h-10 items-center rounded-full bg-papel-2 px-4 text-sm font-semibold text-tinta no-underline lg:inline-flex">
          {t.learn.fullTrailCta}
        </Link>
      </div>

      <div className="lg:hidden">
        {missions && missions.missions.length > 0 && missions.missions.every((m) => m.done) ? (
          <div className="flex items-center gap-1.5 rounded-[18px] bg-menta-clara py-2 pr-3.5 pl-1.5">
            <Mascot pose="comemorando" size={56} alt="Tostão" />
            <div className="flex min-w-0 grow flex-col">
              <span className="text-[15px] font-bold">{t.engagement.allDoneTitle}</span>
              <span className="text-[13px] text-tinta-suave">{t.engagement.allDoneSubtitle}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-[18px] border border-linha bg-cartao py-3 pr-3.5 pl-1.5">
            <Mascot pose="professor" size={84} alt="Tostão" />
            <div className="flex min-w-0 grow flex-col gap-[9px]">
              <Eyebrow>{th.todayMissions}</Eyebrow>
              {missions ? missions.missions.map((m) => (
                <Missao key={m.id} feita={m.done} href={m.id === 'licao' && proxima ? `/aprender/${proxima.id}` : m.href} doneSr={th.doneSr} pendingSr={th.pendingSr}>
                  {m.id === 'gastos' && pendentes > 0 && !m.done ? th.categorizePending(pendentes) : m.title}
                </Missao>
              )) : (
                <Missao feita={doneToday > 0} href={proxima ? `/aprender/${proxima.id}` : '/aprender/trilha'} doneSr={th.doneSr} pendingSr={th.pendingSr}>{th.doLesson}</Missao>
              )}
            </div>
          </div>
        )}
      </div>

      {atual && proxima ? (
        <>
          <div className="flex flex-col items-start gap-4 rounded-[24px] bg-amarelo-claro p-5 sm:flex-row sm:items-center sm:p-6 lg:py-5 lg:pr-6 lg:pl-3">
            <Mascot pose="professor" size={150} alt="Tostão" className="hidden lg:block" />
            <div className="flex min-w-0 w-full flex-1 flex-col gap-2.5">
              <Eyebrow>{t.learn.moduleCounter(atual.number, feitas, atual.lessons.length)}</Eyebrow>
              <h2 className="font-display text-[22px] leading-[27px] font-extrabold lg:text-[34px] lg:leading-[38px]">{atual.title}</h2>
              <p className="hidden max-w-[520px] text-[15px] leading-[22px] lg:block">{atual.goal}</p>
              <div className="flex w-full gap-1.5 lg:max-w-[420px]" role="img" aria-label={t.learn.moduleCounter(atual.number, feitas, atual.lessons.length)}>
                {atual.lessons.map((l) => <i key={l.id} className={`h-2 grow rounded-full ${done.includes(l.id) ? 'bg-tinta' : 'bg-cartao'}`} />)}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[14px] bg-cartao py-2.5 pr-2.5 pl-3.5 lg:hidden">
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs text-tinta-suave">{th.nextLessonMeta}</span>
                  <span className="text-[15px] font-bold">{proxima.title}</span>
                </div>
                <Link href={`/aprender/${proxima.id}`} className="flex h-[38px] shrink-0 items-center rounded-full bg-tinta px-4 text-sm font-semibold text-papel no-underline">
                  {done.length ? t.learn.continueCta : t.learn.startCta}
                </Link>
              </div>
            </div>
          </div>

          <div className="hidden rounded-[22px] border border-linha bg-cartao px-5 py-1.5 lg:block">
            {atual.lessons.map((l) => {
              const isDone = done.includes(l.id);
              const isActive = l.id === proxima.id;
              if (isDone) {
                return (
                  <Link
                    key={l.id}
                    href={`/aprender/${l.id}`}
                    className="flex min-h-[64px] items-center gap-3 border-b border-linha py-2 text-tinta no-underline transition-opacity hover:opacity-80 last:border-b-0"
                  >
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-tinta text-amarelo dark:text-papel">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-base font-semibold">{l.title}</span>
                      <span className="text-xs text-tinta-suave">{t.learn.lessonRowMeta(l.number)}</span>
                    </div>
                    <span className="shrink-0 text-[13px] text-tinta-suave">{t.learn.doneBadge}</span>
                  </Link>
                );
              }
              if (isActive) {
                return (
                  <div
                    key={l.id}
                    className="flex min-h-[64px] items-center gap-3 border-b border-linha py-2 text-tinta last:border-b-0"
                  >
                    <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-laranja text-sm font-bold text-tinta-fixa">
                      {l.number}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-base font-semibold">{l.title}</span>
                      <span className="text-xs text-tinta-suave">{t.learn.lessonRowMeta(l.number)}</span>
                    </div>
                    <Link
                      href={`/aprender/${l.id}`}
                      className="flex h-10 shrink-0 items-center rounded-full bg-tinta px-[18px] text-sm font-semibold text-papel no-underline"
                    >
                      {done.length ? t.learn.continueCta : t.learn.startCta}
                    </Link>
                  </div>
                );
              }
              return (
                <Link
                  key={l.id}
                  href={`/aprender/${l.id}`}
                  className="flex min-h-[64px] items-center gap-3 border-b border-linha py-2 text-tinta no-underline transition-opacity hover:opacity-80 last:border-b-0"
                >
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-papel-2 text-sm font-bold text-tinta-suave">
                    {l.number}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-semibold">{l.title}</span>
                    <span className="text-xs text-tinta-suave">{t.learn.lessonRowMeta(l.number)}</span>
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    role="img"
                    aria-label={t.learn.lockedLabel}
                    className="shrink-0 text-tinta-suave"
                  >
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-[24px] bg-menta-clara p-4 lg:p-6">
          <Mascot pose="comemorando" size={84} alt="Tostão" />
          <p className="text-[15px] leading-[21px]"><b>{t.home.allModulesCompleted}</b> {th.allDoneNote}</p>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <Eyebrow>{th.calculatorsHeading}</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/compensa?voltar=/aprender" className="flex flex-col gap-1 rounded-[18px] border border-linha bg-cartao p-3 text-tinta no-underline transition-colors hover:bg-papel-2 lg:p-4">
            <Mascot pose="investigando" size={56} alt="" />
            <span className="text-[15px] leading-[19px] font-bold">{th.parcelarTitle}</span>
            <span className="text-xs text-tinta-suave">{th.parcelarSub}</span>
          </Link>
          <Link href="/investir?voltar=/aprender" className="flex flex-col gap-1 rounded-[18px] border border-linha bg-cartao p-3 text-tinta no-underline transition-colors hover:bg-papel-2 lg:p-4">
            <Mascot pose="professor" size={56} alt="" />
            <span className="text-[15px] leading-[19px] font-bold">{th.investirTitle}</span>
            <span className="text-xs text-tinta-suave">{th.investirSub}</span>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2 lg:hidden">
        <Eyebrow>{th.weekGamesHeading}</Eyebrow>
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/tribunal?voltar=/aprender" className="flex flex-col gap-1 rounded-[18px] bg-azul p-3 text-tinta no-underline">
            <Mascot pose="pensando" size={56} alt="" />
            <span className="flex items-center gap-1 text-[11px] font-bold tracking-[0.08em] text-tinta-suave uppercase"><Icon src="jogo/tribunal" size={18} />{th.tribunalTag}</span>
            <span className="text-[15px] leading-[19px] font-bold">{tribunal?.case.title ?? th.caseOfWeek}</span>
            <span className="text-xs text-tinta-suave">{tribunal?.myVote != null ? t.learn.votedLabel : t.learn.voteXpHint}</span>
          </Link>
          <Link href="/batalha?voltar=/aprender" className="flex flex-col gap-1 rounded-[18px] bg-amarelo-claro p-3 text-tinta no-underline">
            <Mascot pose="caramelo-bravo" size={56} alt="" />
            <span className="flex items-center gap-1 text-[11px] font-bold tracking-[0.08em] text-tinta-suave uppercase"><Icon src="jogo/batalha" size={18} />{th.battleTag}</span>
            <span className="text-[15px] leading-[19px] font-bold">{tig?.status === 'vencida' ? th.battleWon : th.battleVsTigrinho}</span>
            <span className="text-xs text-tinta-suave">{batalhaLinha}</span>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow>{th.communityHeading}</Eyebrow>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Link href="/amigos?voltar=/aprender" className="flex items-center gap-3 rounded-[18px] bg-menta-clara p-3.5 text-tinta no-underline lg:p-4">
            <Icon src="cat/role" size={40} />
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-[11px] font-bold tracking-[0.08em] text-tinta-suave uppercase">{th.friendsTag}</span>
              <span className="text-[15px] leading-[19px] font-bold">{friendsTitle}</span>
              <span className="text-xs leading-[17px] text-tinta-suave">{friendsSubtitle}</span>
            </span>
          </Link>
          <Link href="/convites?voltar=/aprender" className="flex items-center gap-3 rounded-[18px] border border-linha bg-cartao p-3.5 text-tinta no-underline transition-colors hover:bg-papel-2 lg:p-4">
            <Mascot pose="caramelo-moeda" size={44} alt="" />
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-[11px] font-bold tracking-[0.08em] text-tinta-suave uppercase">{th.invitesTag}</span>
              <span className="text-[15px] leading-[19px] font-bold">{th.invitesTitle}</span>
              <span className="text-xs leading-[17px] text-tinta-suave">{th.invitesSub}</span>
            </span>
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex min-h-9 items-center justify-between">
          <Eyebrow>{proximos.length ? th.nextModules : th.allModules}</Eyebrow>
          <Link href="/aprender/trilha" className="flex h-9 items-center gap-1 text-sm font-semibold text-laranja-texto no-underline">
            {th.seeTrail}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        </div>
        {proximos.length > 0 && (
          <div className="flex flex-col lg:rounded-[22px] lg:border lg:border-linha lg:bg-cartao lg:px-5 lg:py-1">
            {proximos.map((m) => {
              const começou = m.lessons.some((l) => done.includes(l.id));
              return (
                <Link key={m.id} href="/aprender/trilha" className="flex min-h-14 items-center gap-3 border-b border-linha text-tinta no-underline last:border-b-0">
                  <Icon src={`modulo/${m.number}`} size={38} alt={t.pages.learnExtra.moduleAlt(m.number)} />
                  <div className="flex min-w-0 grow flex-col py-2">
                    <span className="text-[15px] font-semibold">{m.title}{m.optional ? th.optionalSuffix : ''}</span>
                    <span className="truncate text-xs text-tinta-suave">{m.goal}</span>
                  </div>
                  {!começou && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={th.notStartedAria} className="shrink-0 text-tinta-suave"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </DesktopSplitShell>
  );
}

function Missao({
  feita,
  href,
  doneSr,
  pendingSr,
  children,
}: {
  feita: boolean;
  href: string;
  doneSr: string;
  pendingSr: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex flex-col gap-1 text-tinta no-underline">
      <span className="flex justify-between text-[13px] font-semibold">
        <span className={feita ? 'text-tinta-suave line-through' : ''}>{children}</span>
        <span>{feita ? '1/1' : '0/1'}</span>
      </span>
      <span className="h-2 rounded-full bg-papel-2" aria-hidden="true">
        <span className={`bar-fill block h-full rounded-full ${feita ? 'w-full bg-menta' : 'w-[4%] bg-tinta'}`} />
      </span>
      <span className="sr-only">{feita ? doneSr : pendingSr}</span>
    </Link>
  );
}
