import { modules, MODULE_COLORS } from '@/lib/lessons';
import { Mascote } from '@/components/mascote';
import { BackLink } from '@/components/ui';
import type { LessonProgressResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { Trilha } from './trilha';

export default async function TrilhaPage() {
  const { done } = await api<LessonProgressResponse>('/progress').catch(() => ({ done: [] as string[] }));
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/aprender" />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[34px] leading-tight font-extrabold">Sua trilha</h1>
        <Mascote pose="professor" size={88} alt="Tostão professor" />
      </div>
      <Trilha modules={modules} colors={MODULE_COLORS} done={done} />
      <div className="mt-2 flex items-center gap-2 rounded-[20px] bg-azul p-3">
        <Mascote pose="urubu-fugindo" size={88} alt="Urubu do Pix fugindo" />
        <div>
          <p className="font-display text-[17px] font-extrabold">No fim da trilha, os vilões fogem</p>
          <p className="text-[13px]">O módulo 9 te ensina a desmascarar o Urubu do Pix e o Tigrinho de vez.</p>
        </div>
      </div>
    </div>
  );
}
