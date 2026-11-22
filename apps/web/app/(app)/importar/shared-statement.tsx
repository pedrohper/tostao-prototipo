'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { Button, ErrorNote } from '@/components/ui';
import { importSharedStatement, type ImportState } from './actions';

/** OFX/CSV que chegou pelo "Compartilhar" do Android: a pessoa só confirma (o arquivo já está guardado por 10 min). */
export function SharedStatement({ shareId, fileName }: { shareId: string; fileName: string }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importSharedStatement, {});
  const r = state.result;
  if (r)
    return (
      <div role="status" className="flex flex-col gap-2 rounded-2xl bg-menta-clara p-4 text-[15px]">
        <p>
          <b>{r.importedCount} lançamento(s) importado(s)</b> em {r.accountName}.
          {r.skipped > 0 && ` ${r.skipped} já estavam aqui.`}
        </p>
        <Link href="/carteira" className="font-semibold underline">
          Ver na Carteira
        </Link>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-tinta bg-cartao p-4">
      <input type="hidden" name="shareId" value={shareId} />
      <p className="text-[15px]">
        Recebi <b className="[overflow-wrap:anywhere]">{fileName}</b> do compartilhamento. Dá um nome pra essa conta e
        importe.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">Nome da conta</span>
        <input
          name="accountName"
          maxLength={40}
          placeholder="Ex.: Nubank, Inter, Caixa"
          className="h-11 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta"
        />
      </label>
      <ErrorNote message={state.error} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Importando…' : 'Importar extrato'}
      </Button>
    </form>
  );
}
