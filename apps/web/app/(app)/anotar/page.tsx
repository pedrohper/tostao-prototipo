import type { CategoryDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { BackLink } from '@/components/ui';
import { todayIso } from '@/lib/format';
import { AnotarForm } from './anotar-form';

export default async function AnotarPage() {
  const { categories } = await api<{ categories: CategoryDTO[] }>('/categories');
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/carteira" />
      <h1 className="font-display text-[28px] font-extrabold">Anotar gasto</h1>
      <p className="-mt-2 text-[15px] text-tinta-suave">Pro dinheiro vivo, pro Pix que o banco ainda não mostrou, ou se você não conectou banco.</p>
      <AnotarForm categories={categories} today={todayIso()} />
    </div>
  );
}
