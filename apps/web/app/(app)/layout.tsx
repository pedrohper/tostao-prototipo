import { TapSoundListener } from '@/components/sons';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/session';
import { Nav } from '@/components/nav';
import { SidebarFooter } from '@/components/lateral';
import { OnboardingShell } from '@/components/onboarding-shell';
import { ToastProvider } from '@/components/toast';
import { FlashToastBridge } from '@/components/flash-toast-bridge';

import { NO_PROGRESS, xpFrom } from '@/lib/xp';

import { getLocale } from '@/lib/i18n-server';
import { orFallback } from '@/lib/rethrow';
import { getMissions, getProgress, getTostaoAuto } from '@/lib/api-queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getToken())) redirect('/entrar');
  const [progress, auto, missions, locale] = await Promise.all([
    getProgress().catch(orFallback(NO_PROGRESS)),
    getTostaoAuto().catch(orFallback(null)),
    getMissions().catch(orFallback(null)),
    getLocale(),
  ]);
  const { xp, level } = xpFrom(progress.done.length, progress.bonusXp ?? 0);
  const pendingCount = auto?.insights.length ?? 0;

  return (
    <ToastProvider locale={locale}>
      <OnboardingShell
        locale={locale}
        nav={
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
        }
      >
        {children}
      </OnboardingShell>
      <TapSoundListener />
      <FlashToastBridge locale={locale} />
    </ToastProvider>
  );
}
