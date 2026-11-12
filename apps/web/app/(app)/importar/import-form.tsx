'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Button, ErrorNote, Field } from '@/components/ui';
import { importStatement, type ImportState } from './actions';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

export function ImportForm({ conta, contas }: { conta?: string; contas: string[] }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importStatement, {});
  const [nome, setNome] = useState(conta ?? '');
  const r = state.result;
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Field label="Nome da conta" name="accountName" placeholder="Itaú, Nubank cartão…" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
        {contas.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Contas que você já importou">
            {contas.map((c) => (
              <button key={c} type="button" onClick={() => setNome(c)}
                className={`h-9 rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold ${nome === c ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao'}`}>{c}</button>
            ))}
          </div>
        )}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Arquivo do extrato (.ofx ou .csv). Pode mandar vários de uma vez.</span>
        <input type="file" name="file" multiple accept=".ofx,.csv,.txt,text/csv,application/x-ofx" required
          className="rounded-xl border-[1.5px] border-dashed border-linha bg-cartao p-4 text-[15px] file:mr-3 file:rounded-full file:border-0 file:bg-tinta file:px-4 file:py-2 file:text-sm file:font-semibold file:text-papel" />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">É de quê?</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-papel-2 p-1">
          {[['auto', 'Descobre'], ['conta', 'Conta'], ['cartao', 'Cartão']].map(([v, l]) => (
            <label key={v} className="cursor-pointer rounded-full py-2 text-center text-[14px] font-semibold has-[:checked]:bg-cartao has-[:checked]:shadow-sm">
              <input type="radio" name="tipo" value={v} defaultChecked={v === 'auto'} className="sr-only" />{l}
            </label>
          ))}
        </div>
        <p className="text-[13px] text-tinta-suave">Fatura de cartão costuma vir com o gasto positivo; marcando “Cartão” eu inverto.</p>
      </fieldset>
      <ErrorNote message={state.error} />
      {r && (
        <div role="status" className="rounded-2xl bg-menta-clara p-3 text-[15px]">
          <b>{r.importedCount} {r.importedCount === 1 ? 'transação nova' : 'transações novas'}</b> em {r.accountName} ({fmt(r.from)} a {fmt(r.to)}).
          {r.skipped > 0 && <> {r.skipped} já estavam aqui e eu pulei.</>} <Link href="/carteira" className="font-semibold underline">Ver na Carteira</Link>
        </div>
      )}
      {state.failed && state.failed.length > 0 && (
        <p className="rounded-2xl bg-rosa p-3 text-[14px]">Não consegui ler: {state.failed.join('; ')}</p>
      )}
      <Button type="submit" disabled={pending}>{pending ? 'Lendo o extrato…' : 'Importar'}</Button>
    </form>
  );
}
