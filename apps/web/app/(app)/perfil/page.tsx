import Link from 'next/link';
import type { BattlesResponse, LessonProgressResponse, ProfileResponse } from '@tostao/contracts';
import { Mascot } from '@/components/mascote';
import { BackLink, Eyebrow, PageFrame } from '@/components/ui';
import { api } from '@/lib/api';
import { resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { logout } from '@/lib/session-actions';
import { modules } from '@/lib/lessons';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';

export default async function PerfilPage({ searchParams }: { searchParams?: Promise<{ voltar?: string }> }) {
  const sp = (await searchParams) ?? {};
  const backHref = resolveBackHref(sp.voltar, '/mais');

  const [profile, { done, streakDays, bonusXp = 0 }, battles, { t }] = await Promise.all([
    api<ProfileResponse>('/me'),
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<BattlesResponse>('/battles').catch(() => null),
    getI18n(),
  ]);

  const { xp, level } = xpFrom(done.length, bonusXp);
  const xpRemaining = level * 100 - xp;
  const totalLessons = modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
  const villainsDefeated = battles
    ? (battles.tigrinho?.status === 'vencida' ? 1 : 0) + (battles.urubu.status === 'vencida' ? 1 : 0)
    : 0;

  const achievement =
    done.length >= totalLessons
      ? { title: t.profile.achievementTrailTitle, desc: t.profile.achievementTrailDesc }
      : streakDays >= 3
        ? { title: t.profile.achievementStreakTitle(streakDays), desc: t.profile.achievementStreakDesc }
        : { title: t.profile.achievementBlueMonthTitle, desc: t.profile.achievementBlueMonthDesc };

  return (
    <PageFrame size="focused">
      <div className="flex items-center gap-1">
        <BackLink href={backHref} label={t.common.back} />
        <h1 className="font-display text-[24px] leading-[30px] font-extrabold text-tinta">
          {t.profile.profilePageTitle}
        </h1>
      </div>

      {/* Identidade e nível */}
      <section className="flex flex-col gap-3 rounded-[22px] border border-linha bg-cartao p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-laranja font-display text-[28px] font-extrabold text-tinta-fixa">
            {profile.name.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-[20px] font-bold text-tinta">{profile.name}</span>
            <span className="truncate text-[13px] text-tinta-suave">{profile.email}</span>
            <span className="mt-0.5 inline-flex self-start rounded-full bg-papel-2 px-2.5 py-0.5 text-xs font-semibold text-tinta">
              {t.profile.levelSummary(level, xp, streakDays)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-linha pt-3">
          <div className="h-2 rounded-full bg-papel-2">
            <div className="h-full rounded-full bg-laranja" style={{ width: `${Math.max(4, xp % 100)}%` }} />
          </div>
          <span className="text-xs text-tinta-suave">{t.nav.xpToNextLevel(xpRemaining, level + 1)}</span>
        </div>
      </section>

      {/* Conquistas */}
      <section className="flex flex-col gap-2.5">
        <Eyebrow>{t.profile.achievementsLabel}</Eyebrow>
        <div className="flex flex-col items-center gap-1.5 rounded-[22px] bg-menta-clara p-5 text-center">
          <Mascot pose="orgulhoso" size={130} alt="Tostão" />
          <span className="text-base font-bold text-tinta">{achievement.title}</span>
          <span className="text-[13px] leading-[18px] text-tinta-suave">{achievement.desc}</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="min-w-0 rounded-[22px] border border-linha bg-cartao px-2 py-3 text-xs font-semibold text-tinta-suave">
            <div className="font-display text-[22px] font-extrabold text-tinta tabular-nums">{streakDays}</div>
            {t.profile.statsDays(streakDays)}
          </div>
          <div className="min-w-0 rounded-[22px] border border-linha bg-cartao px-2 py-3 text-xs font-semibold text-tinta-suave">
            <div className="font-display text-[22px] font-extrabold text-tinta tabular-nums">{done.length}</div>
            {t.profile.statsLessons(done.length)}
          </div>
          <div className="min-w-0 rounded-[22px] border border-linha bg-cartao px-2 py-3 text-xs font-semibold text-tinta-suave">
            <div className="font-display text-[22px] font-extrabold text-tinta tabular-nums">{villainsDefeated}</div>
            {t.profile.statsVillains(villainsDefeated)}
          </div>
        </div>
      </section>

      {/* Gestão da conta */}
      <section className="flex flex-col divide-y divide-linha rounded-[22px] border border-linha bg-cartao px-[18px] py-1">
        {!profile.emailVerifiedAt && (
          <Link
            href="/verificar-email"
            className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-laranja-texto no-underline hover:opacity-80"
          >
            <span>{t.profile.verifyEmailLink}</span>
            <span className="shrink-0" aria-hidden="true">
              ›
            </span>
          </Link>
        )}
        <Link
          href="/aprender?voltar=/perfil"
          className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-tinta no-underline hover:opacity-80"
        >
          <span>{t.profile.continueTrailLink}</span>
          <span className="shrink-0 text-tinta-suave" aria-hidden="true">
            ›
          </span>
        </Link>
        <Link
          href="/conectar?voltar=/perfil"
          className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-vermelho-texto no-underline hover:underline"
        >
          <span>{t.profile.disconnectBanks}</span>
          <span className="shrink-0" aria-hidden="true">
            ›
          </span>
        </Link>
        <Link
          href="/perfil/apagar-conta?voltar=/perfil"
          className="flex min-h-12 items-center justify-between gap-3 text-[15px] font-semibold text-vermelho-texto no-underline hover:underline"
        >
          <span>{t.profile.deleteAccount}</span>
          <span className="shrink-0" aria-hidden="true">
            ›
          </span>
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="flex min-h-12 w-full cursor-pointer items-center text-left text-[15px] font-semibold text-tinta-suave hover:text-tinta"
          >
            {t.profile.signOut}
          </button>
        </form>
      </section>
    </PageFrame>
  );
}
