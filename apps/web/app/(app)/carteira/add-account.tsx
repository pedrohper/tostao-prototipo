'use client';
import { useActionState, useState } from 'react';
import { ErrorNote } from '@/components/ui';
import { getDictionary, type Dictionary } from '@/lib/i18n';
import { createManualAccount, type ActionState } from './actions';

const field =
  'h-11 min-w-0 w-full rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta';

export function AddAccountBox({
  t,
  cancelLabel,
}: {
  t?: Dictionary['walletExtra']['addAccount'];
  cancelLabel?: string;
}) {
  const labels = t ?? getDictionary('pt-BR').walletExtra.addAccount;
  const cancelText = cancelLabel ?? getDictionary('pt-BR').common.cancel;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'BANK' | 'CREDIT'>('BANK');
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const res = await createManualAccount(prev, form);
    if (!res.error) setOpen(false);
    return res;
  }, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-linha px-4 py-2.5 text-sm font-semibold text-tinta-suave transition-colors hover:border-tinta hover:text-tinta"
      >
        <span className="text-base leading-none">+</span> {labels.openCta}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{labels.title}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-tinta-suave underline"
        >
          {cancelText}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {(
          [
            ['BANK', labels.typeBank],
            ['CREDIT', labels.typeCard],
          ] as const
        ).map(([v, label]) => (
          <label
            key={v}
            className={`flex h-9 cursor-pointer items-center justify-center rounded-full text-xs font-semibold ${type === v ? 'bg-tinta text-papel' : 'text-tinta'}`}
          >
            <input
              type="radio"
              name="type"
              value={v}
              checked={type === v}
              onChange={() => setType(v)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
        <input
          name="name"
          placeholder={type === 'CREDIT' ? labels.nameCardPlaceholder : labels.nameBankPlaceholder}
          required
          maxLength={40}
          className={field}
        />
        <input
          name="balance"
          inputMode="decimal"
          placeholder={type === 'CREDIT' ? labels.billPlaceholder : labels.balancePlaceholder}
          className={field}
        />
      </div>
      <ErrorNote message={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="flex h-10 items-center justify-center rounded-full bg-tinta text-sm font-semibold text-papel disabled:opacity-50"
      >
        {pending ? labels.pending : labels.submit}
      </button>
    </form>
  );
}
