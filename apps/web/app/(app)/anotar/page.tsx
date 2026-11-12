import type { CategoryDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { Sheet } from '@/components/sheet';
import { AnotarForm } from './anotar-form';

export default async function AnotarPage() {
  const { categories } = await api<{ categories: CategoryDTO[] }>('/categories');
  return (
    <Sheet back="/carteira">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-2xl leading-[29px] font-extrabold">Anotar gasto</h1>
          <span className="text-[13px] leading-[18px] text-tinta-suave">O Caramelo fareja até o troco do pão.</span>
        </div>
        <Mascote pose="caramelo-farejando" size={64} alt="Caramelo farejando" />
      </div>
      <AnotarForm categories={categories} today={todayIso()} />
    </Sheet>
  );
}
