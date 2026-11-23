import Link from 'next/link';
import type { PersonDTO, TransactionDTO } from '@tostao/contracts';
import { money } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import { desligarPessoa, ligarPessoa } from '../../acertos/actions';
import { AcertoPicker } from './acerto-picker';

/**
 * "Essa compra não é minha" / "foi empréstimo": liga o lançamento a alguém.
 * Sai do gasto e da renda e entra no saldo da pessoa em Acertos.
 */
export function Acerto({
  t,
  people,
  back,
  erro,
  labels,
}: {
  t: TransactionDTO;
  people: PersonDTO[];
  back: string;
  erro?: string;
  labels: Dictionary['walletExtra']['txDetail']['split'];
}) {
  const saida = t.amountInCents < 0;
  const ligada = t.personId ? people.find((p) => p.id === t.personId) : null;
  if (ligada) {
    return (
      <div className="flex flex-col gap-2 rounded-[14px] bg-menta-clara px-3 py-2.5">
        <p className="text-sm leading-5">
          {saida ? (
            <>
              {labels.notMineLead}
              <b>{ligada.name}</b>
              {labels.notMineTail}
            </>
          ) : (
            <>
              {labels.settledLead}
              <b>{ligada.name}</b>
              {labels.settledTail}
            </>
          )}
          {labels.balanceWith(ligada.name)}
          <b>
            {ligada.balanceInCents >= 0
              ? labels.owesAmount(money(ligada.balanceInCents))
              : labels.youOweAmount(money(-ligada.balanceInCents))}
          </b>
          .
        </p>
        <div className="flex flex-wrap gap-x-4">
          <Link href={`/acertos/${ligada.id}`} className="flex h-9 items-center text-[13px] font-semibold text-tinta">
            {labels.viewSplits}
          </Link>
          <form action={desligarPessoa}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="back" value={back} />
            <button
              type="submit"
              className="flex h-9 items-center text-[13px] font-semibold text-tinta-suave underline"
            >
              {labels.undoMine}
            </button>
          </form>
        </div>
      </div>
    );
  }
  return (
    <details className="group rounded-[14px] border border-linha" open={!!erro}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[14px] font-semibold">
        <span>{saida ? labels.notMineSummary : labels.someonePaidSummary}</span>
        <span aria-hidden="true" className="text-tinta-suave transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <form action={ligarPessoa} className="flex flex-col gap-2 px-3 pb-3">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="back" value={back} />
        <p className="text-[13px] text-tinta-suave">{saida ? labels.notMineNote : labels.someonePaidNote}</p>
        <AcertoPicker
          people={people}
          placeholder={people.length ? labels.otherPersonPlaceholder : labels.firstPersonPlaceholder}
          ariaLabel={labels.personAria}
          submitLabel={labels.markCta}
          defaultExpanded={!!erro}
        />
        {erro && (
          <p role="alert" className="text-[13px] font-medium text-vermelho-texto">
            {erro}
          </p>
        )}
      </form>
    </details>
  );
}
