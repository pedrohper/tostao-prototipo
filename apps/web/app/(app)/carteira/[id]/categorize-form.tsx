'use client';
import { CatIcon, Icone } from '@/components/icone';
import { useActionState, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { ErrorNote } from '@/components/ui';
import { pill } from '@/components/sheet';
import { categorize, type ActionState } from '../actions';

type Props = { id: string; back: string; options: CategoryDTO[]; current: string | null; rulePattern: string };

export function CategorizeForm({ id, back, options, current, rulePattern }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(categorize, {});
  const [picked, setPicked] = useState(current);
  const pickedName = options.find((o) => o.id === picked)?.name;
  return (
    <form action={action} className="flex grow flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[13px] font-semibold text-tinta-suave">Categoria</legend>
        <div className="grid grid-cols-3 gap-2">
          {options.map((c) => (
            <label key={c.id} className={`${pill(picked === c.id)} h-11 cursor-pointer`}>
              <input type="radio" name="categoryId" value={c.id} checked={picked === c.id} onChange={() => setPicked(c.id)} className="sr-only" />
              <span className="truncate">{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {picked === 'nao-conta' && (
        <p className="flex gap-2 text-sm text-tinta-suave"><Icone src="cat/nao-conta" size={20} /><span>Não conta: some do gasto e da renda. Bom pra repasse com a família, dinheiro que é de outra pessoa ou acerto entre amigos.</span></p>
      )}
      {rulePattern.length >= 3 && (
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] bg-papel-2 px-3.5 py-2 text-sm leading-5">
          <input type="checkbox" name="remember" defaultChecked className="h-5 w-5 shrink-0 accent-tinta" />
          <span>Sempre colocar “{rulePattern}” em {pickedName ?? '…'}</span>
        </label>
      )}
      <ErrorNote message={state.error} />
      <div className="grow" />
      <button type="submit" disabled={!picked || pending} className="flex h-[54px] shrink-0 items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50">{pending ? 'Salvando…' : 'Salvar'}</button>
    </form>
  );
}
