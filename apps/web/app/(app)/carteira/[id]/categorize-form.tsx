'use client';
import { useActionState, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { Button, ErrorNote } from '@/components/ui';
import { categorize, type ActionState } from '../actions';

type Props = { id: string; back: string; options: CategoryDTO[]; current: string | null; rulePattern: string };

export function CategorizeForm({ id, back, options, current, rulePattern }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(categorize, {});
  const [picked, setPicked] = useState(current);
  const pickedName = options.find((o) => o.id === picked)?.name;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Categoria</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <label key={c.id} className={`cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[15px] font-semibold ${picked === c.id ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao'}`}>
              <input type="radio" name="categoryId" value={c.id} checked={picked === c.id} onChange={() => setPicked(c.id)} className="sr-only" />
              {c.emoji} {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      {rulePattern.length >= 3 && (
        <label className="flex items-center gap-3 rounded-2xl bg-cartao p-3.5 text-[15px]">
          <input type="checkbox" name="remember" defaultChecked className="h-5 w-5 accent-[#FF5A36]" />
          <span>Sempre colocar “{rulePattern}” em {pickedName ?? '…'}</span>
        </label>
      )}
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={!picked || pending}>{pending ? 'Salvando…' : 'Salvar'}</Button>
    </form>
  );
}
