'use client';
import { useActionState, useState } from 'react';
import type { CategoryDTO } from '@tostao/contracts';
import { ErrorNote } from '@/components/ui';
import { pill } from '@/components/sheet';
import { createManual, type ActionState } from '../carteira/actions';

const field = 'h-12 rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none focus:border-tinta';

// As 8 que mais aparecem no dia a dia (igual ao artefato). O resto fica atrás do "Mais".
const PRINCIPAIS = ['delivery', 'comer-fora', 'mercado', 'transporte', 'compras', 'role', 'casa', 'outros'];

export function AnotarForm({ categories, contas, today, children }: { categories: CategoryDTO[]; contas: { id: string; name: string; auto: boolean }[]; today: string; children?: React.ReactNode }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createManual, {});
  const [kind, setKind] = useState<'saida' | 'entrada'>('saida');
  const [cat, setCat] = useState<string | null>(null);
  const [todas, setTodas] = useState(false);
  const [conta, setConta] = useState<string | null>(null);
  const [repete, setRepete] = useState<'nao' | 'mensal' | 'parcelado'>('nao');
  const [vezes, setVezes] = useState(2);
  const doTipo = categories.filter((c) => c.kind === kind);
  const principais = doTipo.filter((c) => PRINCIPAIS.includes(c.id)).sort((a, b) => PRINCIPAIS.indexOf(a.id) - PRINCIPAIS.indexOf(b.id));
  const options = todas || kind === 'entrada' || principais.length < 3 ? doTipo : [...principais, ...doTipo.filter((c) => c.id === cat && !PRINCIPAIS.includes(c.id))];
  const escolhida = contas.find((c) => c.id === conta);
  return (
    <form action={action} className="flex min-h-0 grow flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[520px] grow flex-col gap-3.5 overflow-y-auto px-5 pt-1 pb-4">
      {children}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {(['saida', 'entrada'] as const).map((k) => (
          <label key={k} className={`flex h-10 cursor-pointer items-center justify-center rounded-full text-[15px] font-semibold ${kind === k ? 'bg-tinta text-papel' : 'text-tinta'}`}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => { setKind(k); setCat(null); }} className="sr-only" />
            {k === 'saida' ? 'Saiu' : 'Entrou'}
          </label>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-tinta-suave">Valor</span>
        <span className="flex items-baseline gap-1.5 border-b-2 border-tinta pb-1">
          <span className="font-display text-[28px] font-extrabold">R$</span>
          <input name="amount" inputMode="decimal" placeholder="0,00" required autoFocus className="min-w-0 grow bg-transparent font-display text-[40px] leading-[44px] font-extrabold text-tinta outline-none placeholder:text-linha" />
        </span>
      </label>
      <label className="flex flex-col gap-[5px]">
        <span className="text-[13px] font-semibold">Com o quê?</span>
        <input name="description" placeholder="Ex.: pastel na feira" required className={field} />
      </label>
      <label className="flex flex-col gap-[5px]">
        <span className="text-[13px] font-semibold">Quando?</span>
        <input name="occurredAt" type="date" defaultValue={today} max={today} required className={field} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-semibold">Repete?</legend>
        <input type="hidden" name="repeat" value={repete} />
        <div className="grid grid-cols-3 gap-1 rounded-full bg-papel-2 p-1">
          {([['nao', 'Não'], ['mensal', 'Todo mês'], ['parcelado', 'Parcelado']] as const).map(([v, l]) => (
            <button type="button" key={v} onClick={() => setRepete(v)} aria-pressed={repete === v}
              className={`flex h-10 items-center justify-center rounded-full text-[14px] font-semibold whitespace-nowrap ${repete === v ? 'bg-tinta text-papel' : 'text-tinta'}`}>{l}</button>
          ))}
        </div>
        {repete === 'parcelado' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-linha bg-cartao px-3 py-2">
            <span className="text-[14px]">Em quantas vezes?</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Menos uma vez" onClick={() => setVezes((v) => Math.max(2, v - 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-papel-2 text-xl font-bold">−</button>
              <input name="times" value={vezes} readOnly aria-label="Vezes" className="w-10 bg-transparent text-center text-lg font-bold tabular-nums" />
              <button type="button" aria-label="Mais uma vez" onClick={() => setVezes((v) => Math.min(48, v + 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-papel-2 text-xl font-bold">+</button>
            </div>
          </div>
        )}
        <p className="text-[12px] leading-[17px] text-tinta-suave">
          {repete === 'nao' ? 'Só dessa vez.' : repete === 'mensal' ? 'Já deixo lançado nos próximos 12 meses, e entra na previsão. Dá pra apagar a série depois.' : `O valor é o total: divido em ${vezes}x, uma parcela por mês a partir dessa data.`}
        </p>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-semibold">Categoria <span className="font-normal text-tinta-suave">(opcional, eu tento adivinhar)</span></legend>
        <input type="hidden" name="categoryId" value={cat ?? ''} />
        <div className="flex flex-wrap gap-2">
          {options.map((c) => (
            <button type="button" key={c.id} onClick={() => setCat(cat === c.id ? null : c.id)} className={`${pill(cat === c.id)} h-11 shrink-0 px-4 whitespace-nowrap`}>
              <span>{c.name}</span>
            </button>
          ))}
        </div>
        {options.length < doTipo.length && (
          <button type="button" onClick={() => setTodas(true)} className="self-start text-[13px] font-semibold text-laranja-texto underline">Mais categorias</button>
        )}
      </fieldset>
      {contas.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold">Pago com</legend>
          <input type="hidden" name="accountId" value={conta ?? ''} />
          <div className="flex flex-wrap gap-2">
            {[{ id: null, name: 'Dinheiro' }, ...contas].map((c) => (
              <button type="button" key={c.id ?? 'dinheiro'} onClick={() => setConta(c.id)} className={`${pill(conta === c.id)} h-11 shrink-0 px-4 whitespace-nowrap`}>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          {escolhida?.auto && <p className="text-[12px] leading-[17px] text-tinta-suave">Essa conta já atualiza sozinha pelo banco. Se o gasto aparecer lá também, apaga um dos dois.</p>}
        </fieldset>
      )}
      <ErrorNote message={state.error} />
      </div>
      <div className="shrink-0 border-t border-linha bg-cartao px-5 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]">
        <button type="submit" disabled={pending} className="mx-auto flex h-[54px] w-full max-w-[480px] items-center justify-center rounded-full bg-tinta text-base font-semibold text-papel disabled:opacity-50">
          {pending ? 'Anotando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
