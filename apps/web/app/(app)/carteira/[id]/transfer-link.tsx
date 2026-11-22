import type { TransactionDTO } from '@tostao/contracts';
import { linkTransfer } from '../actions';
import { linkOptions, type LinkAccount } from '@/lib/transfer-link-options';

export type { LinkAccount };

const KIND_LABEL = { card_payment: 'pagamento de fatura', transfer: 'transferência entre contas suas' } as const;
const btn =
  'flex h-11 w-full items-center justify-center rounded-full border border-linha bg-papel-2 px-4 text-sm font-semibold text-tinta transition-colors hover:bg-linha/60';

/**
 * "É pagamento de fatura" e "Transferi pra outra conta minha" (T5.2): liga o lançamento ao cartão ou à conta do outro lado.
 * Sai dos gastos do mês; se a outra ponta é conta manual, o app lança a contrapartida e acerta o saldo dela.
 */
export function TransferLinkForms({ t, accounts, back }: { t: TransactionDTO; accounts: LinkAccount[]; back: string }) {
  const source = accounts.find((a) => a.id === t.accountId) ?? null;
  const linked = t.linkedAccountId ? accounts.find((a) => a.id === t.linkedAccountId) : null;
  const opts = linkOptions(source, accounts);

  const picker = (kind: 'card_payment' | 'transfer', label: string, list: LinkAccount[], help: string) =>
    list.length === 0 ? null : (
      <form action={linkTransfer} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="kind" value={kind} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-tinta-suave">{help}</span>
          <select
            name="targetAccountId"
            required
            defaultValue=""
            className="h-11 min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-3 text-base text-tinta outline-none focus:border-tinta"
          >
            <option value="" disabled>
              Escolha…
            </option>
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={btn}>
          {label}
        </button>
      </form>
    );

  if (t.linkKind) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-[14px] bg-azul px-3 py-2.5 text-sm leading-5 text-tinta">
          Ligado a <b>{linked?.name ?? 'outra conta sua'}</b> como {KIND_LABEL[t.linkKind]}. Não conta como gasto nem
          renda.
        </p>
        <form action={linkTransfer}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="kind" value="none" />
          <button type="submit" className={btn}>
            Desfazer vínculo
          </button>
        </form>
      </div>
    );
  }
  const forms = [
    picker(
      'card_payment',
      'É pagamento de fatura',
      opts.cardPayment,
      source?.type === 'CREDIT' ? 'Quem pagou' : 'Qual cartão',
    ),
    picker('transfer', 'Transferi pra outra conta minha', opts.transfer, 'Conta de destino'),
  ].filter(Boolean);
  if (forms.length === 0) return null;
  return <div className="flex flex-col gap-4">{forms}</div>;
}

/** Tem o que mostrar? (a página só desenha a seção se sim). */
export function hasLinkContent(t: TransactionDTO, accounts: LinkAccount[]): boolean {
  if (t.linkKind) return true;
  const source = accounts.find((a) => a.id === t.accountId) ?? null;
  const o = linkOptions(source, accounts);
  return o.cardPayment.length + o.transfer.length > 0;
}
