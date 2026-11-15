import { SonsDoToque } from '@/components/sons';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/session';
import { Nav } from '@/components/nav';
import { ColunaDireita, RodapeMenu } from '@/components/lateral';
import { api } from '@/lib/api';
import { NO_PROGRESS, xpFrom } from '@/lib/xp';
import type { LessonProgressResponse, MissionsResponse } from '@tostao/contracts';

// Tudo dentro de (app) exige login. Sem cookie, volta pro /entrar.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getToken())) redirect('/entrar');
  const [progress, missions] = await Promise.all([
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    api<MissionsResponse>('/missions').catch(() => null),
  ]);
  const { xp, level } = xpFrom(progress.done.length, progress.bonusXp ?? 0);
  return (
    <div className="md:flex md:min-h-dvh">
      <Nav footer={<RodapeMenu xp={xp} level={level} streakDays={progress.streakDays} />} />
      <SonsDoToque />
      <main className="mx-auto w-full max-w-[640px] min-w-0 px-5 pt-6 pb-28 md:max-w-[820px] md:px-9 md:pt-9 md:pb-12">{children}</main>
      <ColunaDireita missions={missions} />
    </div>
  );
}
