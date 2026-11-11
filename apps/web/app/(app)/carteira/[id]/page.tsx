import type { CategoryDTO, TransactionDetailResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { dayLabel, money } from '@/lib/format';
import { BackLink } from '@/components/ui';
import { Mascote } from '@/components/mascote';
import { CategorizeForm } from './categorize-form';

export default async function CategorizarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ voltar?: string }> }) {
  const { id } = await params;
  const { voltar } = await searchParams;
  const back = voltar?.startsWith('/') ? voltar : '/carteira';
  const [{ transaction: t, rulePattern }, { categories }] = await Promise.all([
    api<TransactionDetailResponse>(`/transactions/${id}`),
    api<{ categories: CategoryDTO[] }>('/categories'),
  ]);
  const kind = t.amountInCents > 0 ? 'entrada' : 'saida';
  const options = categories.filter((c) => (kind === 'entrada') === (c.id === 'salario' || c.id === 'entrada-outros'));

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={back} />
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-tinta-suave">{dayLabel(t.occurredAt)} · {t.accountName ?? 'Anotado na mão'}</span>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-[26px] leading-tight font-extrabold [overflow-wrap:anywhere]">{t.description}</h1>
          <span className="shrink-0 font-display text-[26px] font-extrabold">{money(Math.abs(t.amountInCents))}</span>
        </div>
      </div>
      {t.isInternalTransfer ? (
        <div className="flex items-center gap-3 rounded-[20px] bg-azul p-3">
          <Mascote pose="investigando" size={72} alt="" />
          <p className="text-[15px]">Isso aqui é dinheiro mudando de bolso entre as suas contas. Não conta como gasto nem como renda.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-[20px] bg-cartao p-3">
            <Mascote pose="pensando" size={64} alt="" />
            <p className="text-[15px]">{t.categoryName ? <>Tá em <b>{t.categoryName}</b>. Quer trocar?</> : <>Não reconheci esse nome. Me ajuda a classificar?</>}</p>
          </div>
          <CategorizeForm id={t.id} back={back} options={options} current={t.categoryId} rulePattern={rulePattern} />
        </>
      )}
    </div>
  );
}
