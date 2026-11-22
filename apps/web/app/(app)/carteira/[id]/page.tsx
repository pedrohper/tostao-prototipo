import type { CategoryDTO, PeopleResponse, TransactionDetailResponse } from '@tostao/contracts';
import { Acerto } from './acerto';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { erroDe } from '@/lib/erros';
import { isSafePathSegment, safeInternalPath, safePathSegment } from '@/lib/safe-redirect';
import { dayLabel, money } from '@/lib/format';
import { ConfirmSubmitButton } from '@/components/confirm-dialog';
import { getI18n } from '@/lib/i18n-server';
import { Sheet } from '@/components/sheet';
import { Mascot } from '@/components/mascote';
import { CategorizeForm } from './categorize-form';
import { NicknameForm } from './nickname-form';
import { EditManualForm } from './edit-manual-form';
import { NOTE_MAX } from '@tostao/contracts';
import { apagarLancamento, saveTransactionNote, toggleInternalTransfer } from '../actions';

/** Bloco com título: separa o que o detalhe tem de formulário (categoria, apelido, nota...) em seções claras. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-linha pt-4">
      <h2 className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default async function CategorizarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string; erro?: string }>;
}) {
  const [{ id }, { voltar, erro }, { locale, t: dict }] = await Promise.all([params, searchParams, getI18n()]);
  if (!isSafePathSegment(id)) notFound();
  const d = dict.walletExtra.txDetail;
  const back = safeInternalPath(voltar, '/carteira');
  const [{ transaction: t, rulePattern }, { categories }, { people }] = await Promise.all([
    api<TransactionDetailResponse>(`/transactions/${safePathSegment(id)}`),
    api<{ categories: CategoryDTO[] }>('/categories'),
    api<PeopleResponse>('/people').catch((): PeopleResponse => ({ people: [], owedToYouInCents: 0, youOweInCents: 0 })),
  ]);
  const kind = t.amountInCents > 0 ? 'entrada' : 'saida';
  // Saída mostra categorias de gasto, entrada mostra as de renda. "Não conta" serve pros dois.
  const options = categories.filter((c) => c.kind === kind || c.kind === 'neutra');
  const neutral = t.categoryId === 'nao-conta';
  const acerto = !!t.personId;
  const g = dict.growth.detail;
  const title = t.customDescription || t.description;

  return (
    <Sheet back={back} top={t.isInternalTransfer && !neutral && !acerto ? 260 : 120} closeLabel={dict.common.close}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
          {dayLabel(t.occurredAt, locale)} · {t.accountName ?? d.manualEntry}
        </span>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="min-w-0 text-[17px] leading-6 font-bold [overflow-wrap:anywhere] md:text-[19px] md:leading-7">
            {title}
          </h1>
          <span className="shrink-0 font-display text-2xl font-extrabold tabular-nums">
            {money(Math.abs(t.amountInCents))}
          </span>
        </div>
      </div>
      {acerto ? (
        <Acerto t={t} people={people} back={back} erro={erro === 'nota' ? undefined : erroDe(erro)} labels={d.split} />
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
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center rounded-full border border-linha bg-cartao text-sm font-semibold text-tinta transition-colors hover:bg-papel-2"
            >
              {d.undoTransfer}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 rounded-[14px] bg-rosa px-3 py-2.5 text-tinta">
            <Mascot pose="avatar" size={40} alt="Tostão" />
            <p className="text-sm leading-5">
              {neutral ? (
                <>
                  {d.neutralPromptBefore}
                  <b>{d.neutralPromptBold}</b>
                  {d.neutralPromptAfter}
                </>
              ) : t.categoryName ? (
                <>
                  {d.currentCatBefore}
                  <b>{t.categoryName}</b>
                  {d.currentCatAfter}
                </>
              ) : (
                d.unknownPrompt
              )}
            </p>
          </div>
          <Section title={g.categorySection}>
            <CategorizeForm
              id={t.id}
              back={back}
              options={options}
              kind={kind}
              current={t.categoryId}
              rulePattern={rulePattern}
              locale={locale}
            />
          </Section>
          <Section title={g.transferSection}>
            <form action={toggleInternalTransfer}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="isInternalTransfer" value="true" />
              <input type="hidden" name="back" value={back} />
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-full border border-linha bg-papel-2 px-4 text-sm font-semibold text-tinta transition-colors hover:bg-linha/60"
              >
                {d.markInternalTransfer}
              </button>
            </form>
          </Section>
          <Acerto
            t={t}
            people={people}
            back={back}
            erro={erro === 'nota' ? undefined : erroDe(erro)}
            labels={d.split}
          />
        </>
      )}
      <Section title={g.nicknameSection}>
        <NicknameForm id={t.id} current={t.customDescription} locale={locale} />
      </Section>
      <Section title={g.noteSection}>
        <form action={saveTransactionNote} className="flex flex-col gap-2">
          {erro === 'nota' && (
            <p role="alert" className="rounded-xl bg-rosa px-3 py-2 text-sm text-vermelho-texto">
              {d.noteError}
            </p>
          )}
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="back" value={back} />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-tinta-suave">{d.noteLabel}</span>
            <textarea
              name="note"
              rows={2}
              maxLength={NOTE_MAX}
              defaultValue={t.note ?? ''}
              placeholder={d.notePlaceholder}
              className="min-w-0 resize-none rounded-xl border-[1.5px] border-linha bg-cartao px-3 py-2.5 text-base text-tinta outline-none focus:border-tinta"
            />
          </label>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-full border border-linha bg-cartao text-sm font-semibold text-tinta transition-colors hover:bg-papel-2"
          >
            {d.noteSave}
          </button>
        </form>
      </Section>
      {t.source === 'manual' && (
        <Section title={g.manageSection}>
          <EditManualForm
            id={t.id}
            back={back}
            description={t.description}
            amountInCents={t.amountInCents}
            occurredAt={t.occurredAt}
            locale={locale}
          />
          <form
            action={apagarLancamento}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-linha pt-3"
          >
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="back" value={back} />
            {t.seriesId && (
              <span className="w-full text-[13px] text-tinta-suave">
                {/\(\d+\/\d+\)$/.test(t.description) ? d.manualSeriesInstallment : d.manualSeriesMonthly}
              </span>
            )}
            <ConfirmSubmitButton
              name="serie"
              value="0"
              title={dict.system.deleteEntryTitle}
              description={dict.system.confirmIrreversible}
              confirmLabel={d.deleteThis}
              cancelLabel={dict.common.cancel}
              className="flex h-11 items-center text-[14px] font-semibold text-vermelho-texto hover:underline"
            >
              {d.deleteThis}
            </ConfirmSubmitButton>
            {t.seriesId && (
              <ConfirmSubmitButton
                name="serie"
                value="1"
                title={dict.system.deleteSeriesTitle}
                description={`${dict.system.deleteSeriesBody} ${dict.system.confirmIrreversible}`}
                confirmLabel={d.deleteSeries}
                cancelLabel={dict.common.cancel}
                className="flex h-11 items-center text-[14px] font-semibold text-vermelho-texto hover:underline"
              >
                {d.deleteSeries}
              </ConfirmSubmitButton>
            )}
          </form>
        </Section>
      )}
      {(t.customDescription || t.source === 'bank') && (
        // A descrição do banco nunca muda: é com ela que a conciliação e as regras de categoria trabalham.
        <p className="border-t border-linha pt-3 text-[12px] leading-[17px] break-words text-tinta-suave">
          {g.originalDescription(t.description)}
        </p>
      )}
    </Sheet>
  );
}
