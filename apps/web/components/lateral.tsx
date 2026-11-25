import Link from 'next/link';
import type { MissionsResponse } from '@tostao/contracts';
import { Mascot } from './mascote';
import { SidebarStreakButton } from './streak-modal';
import { getDictionary, type Locale } from '@/lib/i18n';

/** Desktop sidebar footer: clickable streak/XP card (opens streak sequence + missions) and quick "Log expense" action. */
export function SidebarFooter({
  xp,
  level,
  streakDays,
  missions = null,
  locale = 'pt-BR',
}: {
  xp: number;
  level: number;
  streakDays: number;
  missions?: MissionsResponse | null;
  locale?: Locale;
}) {
  const t = getDictionary(locale);

  return (
    <div className="mt-auto hidden flex-col gap-3 md:flex">
      <SidebarStreakButton xp={xp} level={level} streakDays={streakDays} missions={missions} locale={locale} />
      <Link
        href="/anotar"
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-tinta text-body font-semibold text-papel no-underline"
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
    <div className="lg:-mt-9 lg:-mr-10 lg:-mb-16 lg:flex lg:min-h-dvh">
      <div className="flex min-w-0 flex-1 flex-col lg:px-9 lg:py-9 xl:px-11 xl:py-10">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 lg:gap-7 xl:gap-8">{children}</div>
      </div>
      <aside
        className={`hidden shrink-0 flex-col gap-5 border-l border-linha px-6 py-9 lg:flex xl:px-7 xl:py-10 ${asideWidth}`}
      >
        {right}
      </aside>
    </div>
  );
}

/** Right column on desktop screens: active lesson. */
export function RightRail({ locale = 'pt-BR' }: { missions?: MissionsResponse | null; locale?: Locale }) {
  const t = getDictionary(locale);
  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-5 border-l border-linha px-6 pt-9 pb-10 lg:flex">
      <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{t.nav.learnHeader}</span>
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-amarelo-claro p-4">
        <Mascot pose="professor" size={88} alt="Tostão" />
        <span className="font-display text-title leading-[26px] font-extrabold">{t.nav.learnPrompt}</span>
        <Link
          href="/aprender"
          className="flex h-11 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel no-underline"
        >
          {t.nav.continueLesson}
        </Link>
      </div>
    </aside>
  );
}

export const RodapeMenu = SidebarFooter;
export const ColunaDireita = RightRail;
