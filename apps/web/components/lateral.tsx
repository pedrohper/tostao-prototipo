import Link from 'next/link';
import type { MissionsResponse } from '@tostao/contracts';
import { DailyMissions } from './engajamento';
import { Mascot } from './mascote';
import { getDictionary, type Locale } from '@/lib/i18n';

/** Desktop sidebar footer: streak, XP bar, and quick "Log expense" action. */
export function SidebarFooter({
  xp,
  level,
  streakDays,
  locale = 'pt-BR',
}: {
  xp: number;
  level: number;
  streakDays: number;
  locale?: Locale;
}) {
  const xpRemaining = level * 100 - xp;
  const t = getDictionary(locale);

  return (
    <div className="mt-auto hidden flex-col gap-2.5 md:flex">
      <div className="flex flex-col gap-2 rounded-2xl bg-amarelo-claro p-3.5">
        <div className="flex justify-between text-[13px] font-bold">
          <span>{t.nav.streakDays(streakDays)}</span>
          <span>{xp} XP</span>
        </div>
        <div className="h-2 rounded-full bg-cartao">
          <div className="h-full rounded-full bg-tinta" style={{ width: `${Math.max(4, xp % 100)}%` }} />
        </div>
        <span className="text-xs text-tinta-suave">{t.nav.xpToNextLevel(xpRemaining, level + 1)}</span>
      </div>
      <Link
        href="/anotar"
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-tinta text-[15px] font-semibold text-papel no-underline"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t.nav.addExpense}
      </Link>
    </div>
  );
}

/** Three-column desktop shell for core app tabs (Início, Carteira, Tostão, Aprender, Mais). */
export function DesktopSplitShell({
  children,
  right,
  rightWidth = 340,
}: {
  children: React.ReactNode;
  right: React.ReactNode;
  rightWidth?: 320 | 340;
}) {
  const asideWidth =
    rightWidth === 320 ? 'lg:w-[290px] xl:w-[320px] 2xl:w-[348px]' : 'lg:w-[300px] xl:w-[340px] 2xl:w-[360px]';
  return (
    <div className="lg:-mt-8 lg:-mr-8 lg:-mb-12 lg:flex lg:min-h-dvh">
      <div className="flex min-w-0 flex-1 flex-col lg:px-7 lg:py-8 xl:px-9 xl:py-9">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 lg:gap-5 xl:gap-[22px]">{children}</div>
      </div>
      <aside
        className={`hidden shrink-0 flex-col gap-4 border-l border-linha px-5 py-8 lg:flex xl:px-6 xl:py-9 ${asideWidth}`}
      >
        {right}
      </aside>
    </div>
  );
}

/** Right column on desktop screens: active lesson and today's missions. */
export function RightRail({ missions, locale = 'pt-BR' }: { missions: MissionsResponse | null; locale?: Locale }) {
  const t = getDictionary(locale);
  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-4 border-l border-linha px-6 pt-9 pb-10 lg:flex">
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{t.nav.learnHeader}</span>
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-amarelo-claro p-4">
        <Mascot pose="professor" size={88} alt="Tostão" />
        <span className="font-display text-[22px] leading-[26px] font-extrabold">{t.nav.learnPrompt}</span>
        <Link
          href="/aprender"
          className="flex h-11 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel no-underline"
        >
          {t.nav.continueLesson}
        </Link>
      </div>
      {missions && <DailyMissions data={missions} compact locale={locale} />}
    </aside>
  );
}

export const RodapeMenu = SidebarFooter;
export const ColunaDireita = RightRail;
