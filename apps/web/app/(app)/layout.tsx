import { TapSoundListener } from '@/components/sons';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/session';
import { Nav } from '@/components/nav';
import { SidebarFooter } from '@/components/lateral';
import { api } from '@/lib/api';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import type { LessonProgressResponse, MissionsResponse, TostaoAutoResponse } from '@tostao/contracts';
import { getLocale } from '@/lib/i18n-server';
import { orFallback } from '@/lib/rethrow';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getToken())) redirect('/entrar');
  const [progress, auto, missions, locale] = await Promise.all([
    api<LessonProgressResponse>('/progress').catch(orFallback(NO_PROGRESS)),
    api<TostaoAutoResponse>('/tostao/auto').catch(orFallback(null)),
    api<MissionsResponse>('/missions').catch(orFallback(null)),
    getLocale(),
  ]);
  const { xp, level } = xpFrom(progress.done.length, progress.bonusXp ?? 0);
  const pendingCount = auto?.insights.length ?? 0;

  return (
    <div className="md:flex md:min-h-dvh">
      <Nav
        locale={locale}
        pendingCount={pendingCount}
        footer={
          <SidebarFooter
            xp={xp}
            level={level}
            streakDays={missions?.streakDays ?? progress.streakDays}
            missions={missions}
            locale={locale}
          />
        }
      />
      <TapSoundListener />
      <main className="mx-auto w-full max-w-[640px] min-w-0 px-5 pt-7 pb-32 md:max-w-none md:flex-1 md:px-10 md:pt-9 md:pb-16">
        {children}
      </main>
    </div>
  );
}
