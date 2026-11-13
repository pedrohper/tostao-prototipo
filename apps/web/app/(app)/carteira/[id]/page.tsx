import type { CategoryDTO, TransactionDetailResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { dayLabel, money } from '@/lib/format';
import { Sheet } from '@/components/sheet';
import { Mascote } from '@/components/mascote';
import { CategorizeForm } from './categorize-form';
import { apagarLancamento } from '../actions';

export default async function CategorizarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ voltar?: string }> }) {
  const { id } = await params;
  const { voltar } = await searchParams;
  const back = voltar?.startsWith('/') ? voltar : '/carteira';
  const [{ transaction: t, rulePattern }, { categories }] = await Promise.all([
    api<TransactionDetailResponse>(`/transactions/${id}`),
    api<{ categories: CategoryDTO[] }>('/categories'),
  ]);
  const kind = t.amountInCents > 0 ? 'entrada' : 'saida';
  // Saída mostra categorias de gasto, entrada mostra as de renda. "Não conta" serve pros dois.
  const options = categories.filter((c) => c.kind === kind || c.kind === 'neutra');
  const neutral = t.categoryId === 'nao-conta';

  return (
    <Sheet back={back} top={t.isInternalTransfer && !neutral ? 260 : 120}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{dayLabel(t.occurredAt)} · {t.accountName ?? 'Anotado na mão'}</span>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="min-w-0 text-[17px] leading-6 font-bold [overflow-wrap:anywhere]">{t.description}</h1>
          <span className="shrink-0 font-display text-2xl font-extrabold tabular-nums">{money(Math.abs(t.amountInCents))}</span>
        </div>
      </div>
      {t.isInternalTransfer && !neutral ? (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-azul px-3 py-2.5">
          <Mascote pose="investigando" size={40} alt="" />
          <p className="text-sm leading-5">Isso aqui é dinheiro mudando de bolso entre as suas contas. Não conta como gasto nem como renda.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 rounded-[14px] bg-rosa px-3 py-2.5">
            <Mascote pose="avatar" size={40} alt="Tostão" />
            <p className="text-sm leading-5">{neutral ? <>Tá em <b>Não conta</b>: fica fora do gasto e da renda. Quer trocar?</> : t.categoryName ? <>Tá em <b>{t.categoryName}</b>. Quer trocar?</> : <>Não reconheci esse nome. Me ajuda a classificar?</>}</p>
          </div>
          <CategorizeForm id={t.id} back={back} options={options} current={t.categoryId} rulePattern={rulePattern} />
        </>
      )}
      {t.source === 'manual' && (
        <form action={apagarLancamento} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-linha pt-3">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="back" value={back} />
          {t.seriesId && <span className="w-full text-[13px] text-tinta-suave">{/\(\d+\/\d+\)$/.test(t.description) ? 'Faz parte de uma compra parcelada.' : 'Repete todo mês.'}</span>}
          <button type="submit" name="serie" value="0" className="flex h-11 items-center text-[14px] font-semibold text-vermelho-texto">Apagar este</button>
          {t.seriesId && <button type="submit" name="serie" value="1" className="flex h-11 items-center text-[14px] font-semibold text-vermelho-texto">Apagar este e os próximos</button>}
        </form>
      )}
    </Sheet>
  );
}
