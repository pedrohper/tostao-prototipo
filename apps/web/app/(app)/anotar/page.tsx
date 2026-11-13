import type { CategoryDTO, ProfileResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { todayIso } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import Link from 'next/link';
import { AnotarForm } from './anotar-form';

export default async function AnotarPage() {
  const [{ categories }, me] = await Promise.all([
    api<{ categories: CategoryDTO[] }>('/categories'),
    api<ProfileResponse>('/me').catch(() => null),
  ]);
  // "Pago com": contas visíveis. As que vêm do banco atualizam sozinhas, então avisamos do risco de duplicar.
  const contas = (me?.connections ?? []).flatMap((c) => c.accounts.filter((a) => !a.hidden).map((a) => ({ id: a.id, name: a.name, auto: !c.itemId.startsWith('import:') })));
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-papel text-tinta">
      <div className="mx-auto flex w-full max-w-[520px] shrink-0 items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))] pb-1">
        <Link href="/carteira" aria-label="Fechar sem salvar" className="flex h-11 w-11 items-center justify-center rounded-full text-tinta">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </Link>
        <span className="text-[13px] font-semibold text-tinta-suave">Novo lançamento</span>
        <span className="w-11" aria-hidden="true" />
      </div>
      <AnotarForm categories={categories} contas={contas} today={todayIso()}>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-2xl leading-[29px] font-extrabold">Anotar gasto</h1>
            <span className="text-[13px] leading-[18px] text-tinta-suave">O Caramelo fareja até o troco do pão.</span>
          </div>
          <Mascote pose="caramelo-farejando" size={64} alt="Caramelo farejando" />
        </div>
      </AnotarForm>
    </div>
  );
}
