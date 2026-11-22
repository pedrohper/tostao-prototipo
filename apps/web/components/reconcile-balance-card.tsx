'use client';
import { useActionState, useState } from 'react';
import { useToast } from '@/components/toast';
import { money } from '@/lib/format';
import { reconcileBalance, type ReconcileState } from '@/app/(app)/carteira/actions';

export type ReconcileAccount = { id: string; name: string; type: 'BANK' | 'CREDIT'; balanceInCents: number };

/**
 * "Conferir / Ajustar saldo atual" (T5.2): a pessoa digita o saldo que o banco mostra e o Tostão lança UM ajuste com a
 * diferença. Só entra conta manual ou importada (a ligada ao banco tem o saldo do próprio banco). Em cartão, o campo é
 * o valor da FATURA.
 */
export function ReconcileBalanceCard({ accounts }: { accounts: ReconcileAccount[] }) {
  const toast = useToast();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const [state, action, pending] = useActionState<ReconcileState, FormData>(async (prev, form) => {
    const r = await reconcileBalance(prev, form);
    if (r.done) {
      toast.success(
        r.done.deltaInCents === 0
          ? 'Já estava batendo. Nada pra ajustar.'
          : `Saldo ajustado (${r.done.deltaInCents > 0 ? '+' : '−'}${money(Math.abs(r.done.deltaInCents))}).`,
      );
    }
    return r;
  }, {});
  if (!account) return null;
  const isCard = account.type === 'CREDIT';
  const current = isCard ? Math.max(0, -account.balanceInCents) : account.balanceInCents;

  return (
    <details className="group rounded-[22px] border border-linha bg-cartao">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold">
        <span>{isCard ? 'Conferir fatura' : 'Conferir saldo'}</span>
        <span aria-hidden className="text-tinta-suave group-open:rotate-45">
          +
        </span>
      </summary>
      <form action={action} className="flex flex-col gap-3 border-t border-linha px-4 py-3.5">
        <p className="text-[13px] leading-[19px] text-tinta-suave">
          Abra o app do banco e digite o {isCard ? 'valor da fatura' : 'saldo'} que ele mostra. Se tiver diferença
          (centavos, tarifa, algo que ficou sem anotar), o Tostão lança um ajuste e fica igual ao banco. O ajuste não
          conta como gasto.
        </p>
        {accounts.length > 1 ? (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold">Conta</span>
            <select
              name="accountId"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-11 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="accountId" value={account.id} />
        )}
        <input type="hidden" name="isCard" value={isCard ? '1' : '0'} />
        <p className="text-[13px] text-tinta-suave">
          No Tostão agora: <b className="tabular-nums text-tinta">{money(current)}</b>
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">{isCard ? 'Fatura no banco' : 'Saldo no banco'}</span>
          <input
            name="balance"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            required
            className="h-12 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-lg font-semibold tabular-nums text-tinta outline-none focus:border-tinta"
          />
        </label>
        {state.error && (
          <p role="alert" className="rounded-xl bg-rosa px-3 py-2 text-sm text-vermelho-texto">
            {state.error}
          </p>
        )}
        {state.done && (
          <p role="status" className="rounded-xl bg-menta-clara px-3 py-2 text-sm">
            {state.done.deltaInCents === 0
              ? 'Já estava batendo com o banco.'
              : `Ajuste de ${money(Math.abs(state.done.deltaInCents))} lançado. ${isCard ? 'Fatura' : 'Saldo'} agora: ${money(isCard ? Math.max(0, -state.done.balanceInCents) : state.done.balanceInCents)}.`}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-full bg-tinta text-[15px] font-semibold text-papel disabled:opacity-50"
        >
          {pending ? 'Ajustando…' : 'Conferir e ajustar'}
        </button>
      </form>
    </details>
  );
}
