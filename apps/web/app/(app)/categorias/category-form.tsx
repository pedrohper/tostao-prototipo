'use client';
import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, ErrorNote, Field } from '@/components/ui';
import { createCategory, deleteCategory, type CategoryState } from './actions';

export function CategoryForm() {
  const [state, action, pending] = useActionState<CategoryState, FormData>(async (prev, form) => {
    const r = await createCategory(prev, form);
    if (r.ok) ref.current?.reset();
    return r;
  }, {});
  const ref = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<'saida' | 'entrada'>('saida');
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {(['saida', 'entrada'] as const).map((k) => (
          <label key={k} className={`cursor-pointer rounded-full py-2.5 text-center text-[15px] font-semibold ${kind === k ? 'bg-cartao shadow-sm' : 'text-tinta-suave'}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {k === 'saida' ? 'Gasto' : 'Entrada'}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-[72px_1fr] gap-2">
        <Field label="Emoji" name="emoji" placeholder="🏷️" maxLength={16} />
        <Field label="Nome" name="name" placeholder={kind === 'saida' ? 'Faculdade' : 'Mesada'} required maxLength={30} />
      </div>
      <ErrorNote message={state.error} />
      {state.ok && <span className="text-[13px] text-verde-texto">{state.ok}</span>}
      <Button type="submit" disabled={pending}>{pending ? 'Criando…' : 'Criar categoria'}</Button>
    </form>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="text-[13px] font-semibold text-tinta-suave underline disabled:opacity-50">{pending ? '…' : 'Apagar'}</button>;
}

/** Apagar: as transações dela voltam pra "sem categoria". */
export function DeleteCategoryButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteCategory} onSubmit={(e) => { if (!confirm(`Apagar ${name}? As transações dela voltam pra "sem categoria".`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit />
    </form>
  );
}
