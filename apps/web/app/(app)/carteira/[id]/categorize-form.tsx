'use client';
import { Icon } from '@/components/icone';
import { useActionState, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { ErrorNote } from '@/components/ui';
import { pill } from '@/components/sheet';
import type { Dictionary } from '@/lib/i18n';
import { categorize, type ActionState } from '../actions';

type Props = {
  id: string;
  back: string;
  options: CategoryDTO[];
  current: string | null;
  rulePattern: string;
  labels: Dictionary['walletExtra']['txDetail'];
  saveLabel: string;
  savingLabel: string;
};

export function CategorizeForm({ id, back, options, current, rulePattern, labels, saveLabel, savingLabel }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(categorize, {});
  const [picked, setPicked] = useState(current);
  const pickedName = options.find((o) => o.id === picked)?.name;
  return (
    <form action={action} className="flex grow flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[13px] font-semibold text-tinta-suave">{labels.categorizeLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <label key={c.id} className={`${pill(picked === c.id)} h-11 shrink-0 cursor-pointer px-4 whitespace-nowrap`}>
              <input type="radio" name="categoryId" value={c.id} checked={picked === c.id} onChange={() => setPicked(c.id)} className="sr-only" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {picked === 'nao-conta' && (
        <p className="flex gap-2 text-sm text-tinta-suave"><Icon src="cat/nao-conta" size={20} /><span>{labels.neutralHint}</span></p>
      )}
      {rulePattern.length >= 3 && (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] bg-papel-2 px-3.5 py-2 text-sm leading-5">
          <input type="checkbox" name="remember" defaultChecked className="h-5 w-5 shrink-0 accent-tinta" />
          <span>{labels.alwaysRule(rulePattern, pickedName ?? '…')}</span>
        </label>
      )}
      <ErrorNote message={state.error} />
      <div className="grow" />
      <button type="submit" disabled={!picked || pending} className="flex h-[54px] shrink-0 items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50">{pending ? savingLabel : saveLabel}</button>
    </form>
  );
}
