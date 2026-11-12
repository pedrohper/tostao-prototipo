import type { CategoryDTO, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { Sheet } from '@/components/sheet';
import { AnotarForm } from './anotar-form';

export default async function AnotarPage() {
  const [{ categories }, me] = await Promise.all([
    api<{ categories: CategoryDTO[] }>('/categories'),
    api<ProfileResponse>('/me').catch(() => null),
  ]);
  // "Pago com": contas visíveis. As que vêm do banco atualizam sozinhas, então avisamos do risco de duplicar.
  const contas = (me?.connections ?? []).flatMap((c) => c.accounts.filter((a) => !a.hidden).map((a) => ({ id: a.id, name: a.name, auto: !c.itemId.startsWith('import:') })));
  return (
    <Sheet back="/carteira">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display text-2xl leading-[29px] font-extrabold">Anotar gasto</h1>
          <span className="text-[13px] leading-[18px] text-tinta-suave">O Caramelo fareja até o troco do pão.</span>
        </div>
        <Mascote pose="caramelo-farejando" size={64} alt="Caramelo farejando" />
      </div>
      <AnotarForm categories={categories} contas={contas} today={todayIso()} />
    </Sheet>
  );
}
