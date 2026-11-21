'use client';
import { useActionState, useState } from 'react';
import { ErrorNote } from '@/components/ui';
import { getDictionary, type Locale } from '@/lib/i18n';
import { updateManualTransaction, type ActionState } from '../actions';

const field =
  'h-11 min-w-0 w-full rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta';

export function EditManualForm({
  id,
  back,
  description,
  amountInCents,
  occurredAt,
  locale = 'pt-BR',
}: {
  id: string;
  back: string;
  description: string;
  amountInCents: number;
  occurredAt: string;
  locale?: Locale;
}) {
  const dict = getDictionary(locale);
  const labels = dict.walletExtra.txDetail;
  const savingLabel = dict.common.saving;
  const [state, action, pending] = useActionState<ActionState, FormData>(updateManualTransaction, {});
  const [kind, setKind] = useState<'saida' | 'entrada'>(amountInCents > 0 ? 'entrada' : 'saida');
  const initialAmount = (Math.abs(amountInCents) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <details className="rounded-2xl border border-linha bg-papel-2 px-3.5 py-2.5">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-sm font-semibold text-tinta">
        <span>{labels.editToggle}</span>
        <span className="text-xs text-tinta-suave">{labels.editSub}</span>
      </summary>
      <form action={action} className="mt-3 flex flex-col gap-2.5">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back" value={back} />
        <div className="grid grid-cols-2 gap-1 rounded-full bg-cartao p-1">
          {(['saida', 'entrada'] as const).map((k) => (
            <label
              key={k}
              className={`flex h-9 cursor-pointer items-center justify-center rounded-full text-sm font-semibold ${kind === k ? 'bg-tinta text-papel' : 'text-tinta'}`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
                className="sr-only"
              />
              {k === 'saida' ? labels.kindOut : labels.kindIn}
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-tinta-suave">{labels.descLabel}</span>
          <input name="description" defaultValue={description} required className={field} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-tinta-suave">{labels.amountLabel}</span>
            <input name="amount" defaultValue={initialAmount} inputMode="decimal" required className={field} />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-tinta-suave">{labels.dateLabel}</span>
            <input name="occurredAt" type="date" defaultValue={occurredAt.slice(0, 10)} required className={field} />
          </label>
        </div>
        <ErrorNote message={state.error} />
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel disabled:opacity-50"
        >
          {pending ? savingLabel : labels.saveChanges}
        </button>
      </form>
    </details>
  );
}
