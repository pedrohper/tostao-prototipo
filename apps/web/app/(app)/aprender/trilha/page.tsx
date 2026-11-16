import { NO_PROGRESS } from '@/lib/xp';
import { modules, MODULE_COLORS } from '@/lib/lessons';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import type { LessonProgressResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Trilha } from './trilha';

export default async function TrilhaPage() {
  const [{ done }, { t }] = await Promise.all([
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    getI18n(),
  ]);
  const tl = t.pages.learnExtra;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2.5">
      <BackLink href="/aprender" label={t.common.back} />
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-[34px] leading-[38px] font-extrabold md:text-[40px] md:leading-[44px]">
          {tl.trailTitle}
        </h1>
        <Mascot pose="professor" size={92} alt="Tostão" />
      </div>
      <Trilha modules={modules} colors={MODULE_COLORS} done={done} t={tl} />
      <div className="mt-[18px] flex items-center gap-2 rounded-[20px] bg-azul py-3.5 pr-4 pl-2">
        <Mascot pose="urubu-fugindo" size={96} alt="" />
        <div className="flex flex-col gap-1">
          <p className="font-display text-[17px] leading-[21px] font-extrabold">{tl.trailHeroTitle}</p>
          <p className="text-[13px] leading-[18px]">{tl.trailHeroBody}</p>
        </div>
      </div>
    </div>
  );
}
