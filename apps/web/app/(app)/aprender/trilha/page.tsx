import { NO_PROGRESS } from '@/lib/xp';
import { modules, MODULE_COLORS } from '@/lib/lessons';
import { getI18n } from '@/lib/i18n-server';
import { Mascot } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import type { LessonProgressResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { getBookCoverAssets, getBookPageAssets } from '@/lib/art-assets';
import { Trilha } from './trilha';

export default async function TrilhaPage() {
  const [{ done }, { locale, t }] = await Promise.all([
    api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS),
    getI18n(),
  ]);
  const tl = t.pages.learnExtra;
  const coverAssets = getBookCoverAssets(modules.map((m) => m.number));
  const firstPageAssets = getBookPageAssets(modules.flatMap((m) => (m.lessons[0] ? [m.lessons[0].id] : [])));
  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-3">
      <BackLink href="/aprender" label={t.common.back} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-[32px] leading-[36px] font-extrabold md:text-[38px] md:leading-[42px]">
            {tl.trailTitle}
          </h1>
          <p className="text-sm text-tinta-suave">{tl.hub.librarySubtitle}</p>
        </div>
        <Mascot pose="professor" size={88} alt="Tostão" />
      </div>
      <Trilha
        modules={modules}
        colors={MODULE_COLORS}
        done={done}
        coverAssets={coverAssets}
        firstPageAssets={firstPageAssets}
        locale={locale}
      />
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
