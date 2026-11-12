import { NO_PROGRESS } from '@/lib/xp';
import { modules, MODULE_COLORS } from '@/lib/lessons';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import type { LessonProgressResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Trilha } from './trilha';

export default async function TrilhaPage() {
  const { done } = await api<LessonProgressResponse>('/progress').catch(() => NO_PROGRESS);
  return (
    <div className="flex flex-col gap-2.5">
      <BackLink href="/aprender" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Sua trilha</h1>
        <Mascote pose="professor" size={92} alt="Tostão professor" />
      </div>
      <Trilha modules={modules} colors={MODULE_COLORS} done={done} />
      <div className="mt-[18px] flex items-center gap-2 rounded-[20px] bg-azul py-3.5 pr-4 pl-2">
        <Mascote pose="urubu-fugindo" size={96} alt="Urubu do Pix fugindo" />
        <div className="flex flex-col gap-1">
          <p className="font-display text-[17px] leading-[21px] font-extrabold">No fim da trilha, os vilões fogem</p>
          <p className="text-[13px] leading-[18px]">O módulo 9 te ensina a desmascarar o Urubu do Pix e o Tigrinho de vez.</p>
        </div>
      </div>
    </div>
  );
}
