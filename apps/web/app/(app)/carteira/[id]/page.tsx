import type { CategoryDTO, PeopleResponse, TransactionDetailResponse } from '@tostao/contracts';
import { Acerto } from './acerto';
import { api } from '@/lib/api';
import { dayLabel, money } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { Sheet } from '@/components/sheet';
import { Mascot } from '@/components/mascote';
import { CategorizeForm } from './categorize-form';
import { EditManualForm } from './edit-manual-form';
import { apagarLancamento, toggleInternalTransfer } from '../actions';

export default async function CategorizarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ voltar?: string; erro?: string }> }) {
  const [{ id }, { voltar, erro }, { locale, t: dict }] = await Promise.all([params, searchParams, getI18n()]);
  const d = dict.walletExtra.txDetail;
  const back = voltar?.startsWith('/') ? voltar : '/carteira';
  const [{ transaction: t, rulePattern }, { categories }, { people }] = await Promise.all([
    api<TransactionDetailResponse>(`/transactions/${id}`),
    api<{ categories: CategoryDTO[] }>('/categories'),
    api<PeopleResponse>('/people').catch((): PeopleResponse => ({ people: [], owedToYouInCents: 0, youOweInCents: 0 })),
  ]);
  const kind = t.amountInCents > 0 ? 'entrada' : 'saida';
  // Saída mostra categorias de gasto, entrada mostra as de renda. "Não conta" serve pros dois.
  const options = categories.filter((c) => c.kind === kind || c.kind === 'neutra');
  const neutral = t.categoryId === 'nao-conta';
  const acerto = !!t.personId;

  return (
    <Sheet back={back} top={t.isInternalTransfer && !neutral && !acerto ? 260 : 120} closeLabel={dict.common.close}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{dayLabel(t.occurredAt, locale)} · {t.accountName ?? d.manualEntry}</span>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="min-w-0 text-[17px] leading-6 font-bold [overflow-wrap:anywhere] md:text-[19px] md:leading-7">{t.description}</h1>
          <span className="shrink-0 font-display text-2xl font-extrabold tabular-nums">{money(Math.abs(t.amountInCents))}</span>
        </div>
      </div>
      {acerto ? (
        <Acerto t={t} people={people} back={back} erro={erro} labels={d.split} />
      ) : t.isInternalTransfer && !neutral ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 rounded-[14px] bg-azul px-3 py-2.5 text-tinta">
            <Mascot pose="investigando" size={40} alt="" />
            <p className="text-sm leading-5">{d.transferNotice}</p>
          </div>
          <form action={toggleInternalTransfer}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="isInternalTransfer" value="false" />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className="flex h-11 w-full items-center justify-center rounded-full border border-linha bg-cartao text-sm font-semibold text-tinta transition-colors hover:bg-papel-2">
              {d.undoTransfer}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 rounded-[14px] bg-rosa px-3 py-2.5 text-tinta">
            <Mascot pose="avatar" size={40} alt="Tostão" />
            <p className="text-sm leading-5">
              {neutral
                ? <>{d.neutralPromptBefore}<b>{d.neutralPromptBold}</b>{d.neutralPromptAfter}</>
                : t.categoryName
                  ? <>{d.currentCatBefore}<b>{t.categoryName}</b>{d.currentCatAfter}</>
                  : d.unknownPrompt}
            </p>
          </div>
          <CategorizeForm id={t.id} back={back} options={options} current={t.categoryId} rulePattern={rulePattern} labels={d} saveLabel={dict.common.save} savingLabel={dict.common.saving} />
          <form action={toggleInternalTransfer}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="isInternalTransfer" value="true" />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className="flex h-11 w-full items-center justify-center rounded-full border border-linha bg-papel-2 px-4 text-sm font-semibold text-tinta transition-colors hover:bg-linha/60">
              {d.markInternalTransfer}
            </button>
          </form>
          <Acerto t={t} people={people} back={back} erro={erro} labels={d.split} />
        </>
      )}
      {t.source === 'manual' && (
        <EditManualForm id={t.id} back={back} description={t.description} amountInCents={t.amountInCents} occurredAt={t.occurredAt} labels={d} savingLabel={dict.common.saving} />
      )}
      {t.source === 'manual' && (
        <form action={apagarLancamento} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-linha pt-3">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="back" value={back} />
          {t.seriesId && <span className="w-full text-[13px] text-tinta-suave">{/\(\d+\/\d+\)$/.test(t.description) ? d.manualSeriesInstallment : d.manualSeriesMonthly}</span>}
          <button type="submit" name="serie" value="0" className="flex h-11 items-center text-[14px] font-semibold text-vermelho-texto hover:underline">{d.deleteThis}</button>
          {t.seriesId && <button type="submit" name="serie" value="1" className="flex h-11 items-center text-[14px] font-semibold text-vermelho-texto hover:underline">{d.deleteSeries}</button>}
        </form>
      )}
    </Sheet>
  );
}
