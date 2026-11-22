'use client';
import { useActionState, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { ErrorNote, CardIcon, BankIcon } from '@/components/ui';
import { Mascot } from '@/components/mascote';
import { pill } from '@/components/sheet';
import { useToast } from '@/components/toast';
import { AmountInput, CategoryPills, DateChips, DescriptionInput, NoteField } from '@/components/quick-add-fields';
import { centsFromMasked } from '@/lib/money-mask';
import { money } from '@/lib/format';
import { installmentCents } from '@/lib/recurring-form';
import { canSaveQuickAdd } from '@/lib/quick-add';
import { getDictionary, type Locale } from '@/lib/i18n';
import { createManual, type ActionState } from '../carteira/actions';

export type ContaOption = {
  id: string;
  name: string;
  type?: 'BANK' | 'CREDIT';
  institution?: string | null;
  auto: boolean;
};

export function AnotarForm({
  categories,
  contas,
  today,
  recents = [],
  back = '/carteira',
  locale = 'pt-BR',
  children,
}: {
  categories: CategoryDTO[];
  contas: ContaOption[];
  today: string;
  /** Últimas descrições que a pessoa usou (sugestões enquanto digita). */
  recents?: string[];
  /** Pra onde voltar depois de salvar. */
  back?: string;
  locale?: Locale;
  children?: React.ReactNode;
}) {
  const dict = getDictionary(locale);
  const labels = dict.pages.anotar;
  const saveText = dict.common.save;
  const q = dict.growth.quickAdd;
  const toast = useToast();
  // Qual botão enviou: só pra trocar o texto "Anotando…" no botão certo.
  const [sending, setSending] = useState<'save' | 'another'>('save');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  // "Salvar e anotar outro": a ação não redireciona. Aqui (e não num efeito) mostra o toast e limpa valor, descrição,
  // nota e categoria, mantendo tipo, data e conta pra quem anota vários seguidos.
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await createManual(prev, formData);
    if (result.saved) {
      toast.success(q.savedAnother);
      setAmount('');
      setDescription('');
      setNote('');
      setNoteOpen(false);
      setCat(null);
    }
    return result;
  }, {});
  const [kind, setKind] = useState<'saida' | 'entrada'>('saida');
  const [todas, setTodas] = useState(false);
  const [conta, setConta] = useState<string | null>(null);
  const [repete, setRepete] = useState<'nao' | 'mensal' | 'parcelado'>('nao');
  const [vezes, setVezes] = useState(2);
  // "Lançar sozinho" (T5.2): vira uma regra que o app executa no dia. Só vale pra dinheiro ou conta manual/importada
  // (conta ligada ao banco já recebe o lançamento de verdade: lançar sozinho duplicaria).
  const [automatico, setAutomatico] = useState(true);
  const ready = canSaveQuickAdd({ cents: centsFromMasked(amount), description });
  const escolhida = contas.find((c) => c.id === conta);
  const podeAutomatico = !escolhida?.auto;

  return (
    <form action={action} className="flex min-h-0 grow flex-col">
      <input type="hidden" name="back" value={back} />
      <div className="mx-auto flex min-h-0 w-full max-w-[520px] grow flex-col gap-3.5 overflow-y-auto px-5 pt-1 pb-4 md:max-w-none md:px-6">
        {children ?? (
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex flex-col gap-0.5">
              <h1 className="font-display text-2xl leading-[29px] font-extrabold">
                {kind === 'saida' ? labels.titleOut : labels.titleIn}
              </h1>
              <span className="text-[13px] leading-[18px] text-tinta-suave">
                {kind === 'saida' ? labels.subOut : labels.subIn}
              </span>
            </div>
            <Mascot
              pose={kind === 'saida' ? 'caramelo-farejando' : 'caramelo-feliz'}
              size={64}
              alt={kind === 'saida' ? labels.altOut : labels.altIn}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
          {(['saida', 'entrada'] as const).map((k) => (
            <label
              key={k}
              className={`flex h-10 cursor-pointer items-center justify-center rounded-full text-[15px] font-semibold transition-colors ${kind === k ? 'bg-tinta text-papel' : 'text-tinta hover:bg-cartao/60'}`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  setCat(null);
                }}
                className="sr-only"
              />
              {k === 'saida' ? labels.kindOut : labels.kindIn}
            </label>
          ))}
        </div>
        <AmountInput value={amount} onChange={setAmount} label={labels.amountLabel} autoFocus />
        <DateChips value={date} onChange={setDate} today={today} locale={locale} />
        <DescriptionInput
          value={description}
          onChange={setDescription}
          recents={recents}
          label={labels.descLabel}
          placeholder={labels.descPlaceholder}
        />
        <NoteField
          value={note}
          onChange={setNote}
          open={noteOpen}
          onOpen={() => setNoteOpen(true)}
          addLabel={q.addNote}
          placeholder={labels.notePlaceholder}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold">{labels.repeatLegend}</legend>
          <input type="hidden" name="repeat" value={repete} />
          <div className="grid grid-cols-3 gap-1 rounded-full bg-papel-2 p-1">
            {(
              [
                ['nao', labels.repeatNo],
                ['mensal', labels.repeatMonthly],
                ['parcelado', labels.repeatInstallment],
              ] as const
            ).map(([v, l]) => (
              <button
                type="button"
                key={v}
                onClick={() => setRepete(v)}
                aria-pressed={repete === v}
                className={`flex h-10 items-center justify-center rounded-full text-[14px] font-semibold whitespace-nowrap transition-colors ${repete === v ? 'bg-tinta text-papel' : 'text-tinta hover:bg-cartao/60'}`}
              >
                {l}
              </button>
            ))}
          </div>
          {repete === 'parcelado' && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-linha bg-cartao px-3 py-2">
              <span className="text-[14px]">{labels.timesQuestion}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={labels.timesMinusAria}
                  onClick={() => setVezes((v) => Math.max(2, v - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-papel-2 text-xl font-bold hover:bg-linha/60"
                >
                  −
                </button>
                <input
                  name="times"
                  value={vezes}
                  readOnly
                  aria-label={labels.timesAria}
                  className="w-10 bg-transparent text-center text-lg font-bold tabular-nums"
                />
                <button
                  type="button"
                  aria-label={labels.timesPlusAria}
                  onClick={() => setVezes((v) => Math.min(48, v + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-papel-2 text-xl font-bold hover:bg-linha/60"
                >
                  +
                </button>
              </div>
            </div>
          )}
          <p className="text-[12px] leading-[17px] text-tinta-suave">
            {repete === 'nao'
              ? labels.repeatNoHint
              : repete === 'mensal'
                ? labels.repeatMonthlyHint
                : labels.repeatInstallmentHint(vezes)}
          </p>
          {repete !== 'nao' && (
            <label
              className={`flex items-start gap-2.5 rounded-xl border-[1.5px] border-linha bg-cartao px-3 py-2.5 ${podeAutomatico ? 'cursor-pointer' : 'opacity-60'}`}
            >
              <input
                type="checkbox"
                name="automatic"
                checked={automatico && podeAutomatico}
                disabled={!podeAutomatico}
                onChange={(e) => setAutomatico(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-tinta)]"
              />
              <span className="flex flex-col text-[14px] leading-5">
                <b className="font-semibold">Lançar sozinho no dia</b>
                <span className="text-[12px] leading-[17px] text-tinta-suave">
                  {!podeAutomatico
                    ? 'Essa conta é ligada ao banco e já traz os lançamentos sozinha.'
                    : repete === 'parcelado'
                      ? `Cada parcela de ${money(installmentCents(centsFromMasked(amount) ?? 0, vezes))} entra sozinha todo mês, na data certa, e o saldo da conta manual acompanha.`
                      : 'O Tostão lança todo mês, na data certa, sem você precisar anotar de novo. Dá pra pausar ou apagar depois.'}
                </span>
              </span>
            </label>
          )}
        </fieldset>
        <CategoryPills
          categories={categories}
          kind={kind}
          value={cat}
          onChange={setCat}
          showAll={todas}
          onShowAll={() => setTodas(true)}
          legend={
            <>
              {labels.categoryLegend} <span className="font-normal text-tinta-suave">{labels.categoryOptional}</span>
            </>
          }
          moreLabel={labels.moreCategories}
        />
        {contas.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-semibold">
              {kind === 'saida' ? labels.paidWith : labels.receivedIn}
            </legend>
            <input type="hidden" name="accountId" value={conta ?? ''} />
            <div className="flex flex-wrap gap-2">
              {[
                { id: null, name: labels.cash, type: undefined, auto: false } as {
                  id: string | null;
                  name: string;
                  type?: 'BANK' | 'CREDIT';
                  auto?: boolean;
                },
                ...contas,
              ].map((c) => {
                const isCard = c.type === 'CREDIT';
                const isBank = c.type === 'BANK';
                const isSelected = conta === c.id;
                return (
                  <button
                    type="button"
                    key={c.id ?? 'dinheiro'}
                    onClick={() => setConta(c.id)}
                    className={`${pill(isSelected)} h-11 shrink-0 px-3.5 whitespace-nowrap flex items-center gap-1.5`}
                  >
                    {isCard && <CardIcon className="opacity-70" />}
                    {isBank && <BankIcon className="opacity-70" />}
                    <span>{c.name}</span>
                    {c.type && (
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-papel/20 text-papel' : 'bg-papel-2 text-tinta-suave'
                        }`}
                      >
                        {isCard ? labels.cardTag : labels.accountTag}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {escolhida?.auto && (
              <p className="text-[12px] leading-[17px] text-tinta-suave">
                {kind === 'saida' ? labels.autoAccountWarnOut : labels.autoAccountWarnIn}
              </p>
            )}
          </fieldset>
        )}
        <ErrorNote message={state.error} />
      </div>
      <div className="shrink-0 border-t border-linha bg-cartao px-5 pt-3 pb-[max(28px,env(safe-area-inset-bottom))] md:px-6 md:pb-5">
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-2 md:max-w-none">
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending || !ready}
            onClick={() => {
              setSending('save');
            }}
            className="flex h-[54px] w-full items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending && sending === 'save' ? labels.saving : saveText}
          </button>
          <button
            type="submit"
            name="intent"
            value="another"
            disabled={pending || !ready}
            onClick={() => {
              setSending('another');
            }}
            className="flex h-11 w-full items-center justify-center rounded-full border-[1.5px] border-tinta text-[15px] font-semibold text-tinta disabled:opacity-50"
          >
            {pending && sending === 'another' ? labels.saving : q.saveAnother}
          </button>
        </div>
      </div>
    </form>
  );
}
