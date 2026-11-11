'use client';
import { useActionState, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { Button, ErrorNote, Field } from '@/components/ui';
import { createManual, type ActionState } from '../carteira/actions';

const INCOME = new Set(['salario', 'entrada-outros']);

export function AnotarForm({ categories, today }: { categories: CategoryDTO[]; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createManual, {});
  const [kind, setKind] = useState<'saida' | 'entrada'>('saida');
  const [cat, setCat] = useState<string | null>(null);
  const options = categories.filter((c) => (kind === 'entrada') === INCOME.has(c.id));
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {(['saida', 'entrada'] as const).map((k) => (
          <label key={k} className={`cursor-pointer rounded-full py-2.5 text-center text-[15px] font-semibold ${kind === k ? 'bg-cartao shadow-sm' : 'text-tinta-suave'}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => { setKind(k); setCat(null); }} className="sr-only" />
            {k === 'saida' ? 'Saiu' : 'Entrou'}
          </label>
        ))}
      </div>
      <label className="flex flex-col items-center gap-1 py-2">
        <span className="text-sm font-semibold text-tinta-suave">Quanto?</span>
        <div className="flex items-baseline gap-1 font-display text-[44px] font-extrabold">
          <span>R$</span>
          <input name="amount" inputMode="decimal" placeholder="0,00" required autoFocus className="w-44 bg-transparent text-center outline-none placeholder:text-linha" />
        </div>
      </label>
      <Field label="O que foi?" name="description" placeholder="Pastel da feira" required />
      <Field label="Quando?" name="occurredAt" type="date" defaultValue={today} max={today} required />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Categoria <span className="font-normal text-tinta-suave">(opcional, eu tento adivinhar)</span></legend>
        <input type="hidden" name="categoryId" value={cat ?? ''} />
        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <button type="button" key={c.id} onClick={() => setCat(cat === c.id ? null : c.id)}
              className={`rounded-full border-[1.5px] px-3.5 py-2 text-[15px] font-semibold ${cat === c.id ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao'}`}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </fieldset>
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>{pending ? 'Anotando…' : 'Anotar'}</Button>
    </form>
  );
}
