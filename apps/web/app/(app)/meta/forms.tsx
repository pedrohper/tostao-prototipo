'use client';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { GoalStatus } from '@tostao/contracts';
import { deposit, saveGoal, type GoalState } from './actions';

const field = 'h-12 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-4 text-base text-tinta outline-none focus:border-tinta';
const pill = (on: boolean) => `rounded-full px-3.5 py-2 text-sm font-semibold ${on ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`;
const KINDS = [['reserva', 'Montar reserva'], ['viagem', 'Viajar'], ['sair-do-vermelho', 'Sair do vermelho'], ['outro', 'Outra coisa']] as const;
const toMoney = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>{pending ? '…' : children}</button>;
}

/** Criar ou editar a meta. */
export function GoalForm({ goal, kind: initialKind }: { goal: GoalStatus | null; kind?: string }) {
  const [state, action] = useActionState<GoalState, FormData>(saveGoal, {});
  const [kind, setKind] = useState(initialKind ?? 'viagem');
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="kind" value={kind} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-semibold">Pra quê?</legend>
        {KINDS.map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={pill(kind === k)}>{l}</button>)}
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Nome da meta
        <input name="label" defaultValue={goal?.label ?? ''} maxLength={60} placeholder="Ex.: Praia em julho" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Quanto
          <input name="amount" inputMode="decimal" defaultValue={goal?.amountInCents ? toMoney(goal.amountInCents) : ''} placeholder="R$ 0,00" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">Até quando
          <input name="deadline" type="month" defaultValue={goal?.deadline ?? ''} className={`${field} px-2.5`} />
        </label>
      </div>
      {state.error && <p role="alert" className="text-sm font-semibold text-vermelho-texto">{state.error}</p>}
      <Submit className="h-[50px] rounded-full bg-tinta text-[15px] font-semibold text-papel">{goal ? 'Salvar meta' : 'Criar meta'}</Submit>
    </form>
  );
}

/** "Guardei" (ou "Tirei") um valor da meta. */
export function DepositForm() {
  const [state, action] = useActionState<GoalState, FormData>(deposit, {});
  const [dir, setDir] = useState<'guardei' | 'tirei'>('guardei');
  const [amount, setAmount] = useState('');
  return (
    <form action={async (f) => { await action(f); setAmount(''); }} className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
      <input type="hidden" name="dir" value={dir} />
      <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1">
        {(['guardei', 'tirei'] as const).map((d) => (
          <button key={d} type="button" aria-pressed={dir === d} onClick={() => setDir(d)} className={`h-[38px] rounded-full text-sm font-semibold ${dir === d ? 'bg-tinta text-papel' : 'text-tinta'}`}>{d === 'guardei' ? 'Guardei' : 'Tirei'}</button>
        ))}
      </div>
      <div className="flex gap-2">
        {[20, 50, 100].map((v) => <button key={v} type="button" onClick={() => setAmount(`${v},00`)} className={pill(amount === `${v},00`)}>R$ {v}</button>)}
      </div>
      <div className="flex gap-2">
        <input name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="R$ outro valor" aria-label="Valor" className={`${field} grow`} />
        <Submit className="h-12 shrink-0 rounded-xl bg-tinta px-5 text-[15px] font-semibold text-papel">Anotar</Submit>
      </div>
      {(state.error || state.message) && <p role="status" className={`text-sm ${state.error ? 'font-semibold text-vermelho-texto' : 'text-tinta-suave'}`}>{state.error ?? state.message}</p>}
    </form>
  );
}
