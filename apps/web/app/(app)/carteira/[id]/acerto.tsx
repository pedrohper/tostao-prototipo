import Link from 'next/link';
import type { PersonDTO, TransactionDTO } from '@tostao/contracts';
import { money } from '@/lib/format';
import type { Dictionary } from '@/lib/i18n';
import { desligarPessoa, ligarPessoa } from '../../acertos/actions';

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
          {saida
            ? <>{labels.notMineLead}<b>{ligada.name}</b>{labels.notMineTail}</>
            : <>{labels.settledLead}<b>{ligada.name}</b>{labels.settledTail}</>}
          {labels.balanceWith(ligada.name)}
          <b>{ligada.balanceInCents >= 0 ? labels.owesAmount(money(ligada.balanceInCents)) : labels.youOweAmount(money(-ligada.balanceInCents))}</b>.
        </p>
        <div className="flex flex-wrap gap-x-4">
          <Link href={`/acertos/${ligada.id}`} className="flex h-9 items-center text-[13px] font-semibold text-tinta">{labels.viewSplits}</Link>
          <form action={desligarPessoa}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className="flex h-9 items-center text-[13px] font-semibold text-tinta-suave underline">{labels.undoMine}</button>
          </form>
        </div>
      </div>
    );
  }
  return (
    <details className="group rounded-[14px] border border-linha" open={!!erro}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[14px] font-semibold">
        <span>{saida ? labels.notMineSummary : labels.someonePaidSummary}</span>
        <span aria-hidden="true" className="text-tinta-suave transition-transform group-open:rotate-90">›</span>
      </summary>
      <form action={ligarPessoa} className="flex flex-col gap-2 px-3 pb-3">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="back" value={back} />
        <p className="text-[13px] text-tinta-suave">{saida ? labels.notMineNote : labels.someonePaidNote}</p>
        {people.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {people.slice(0, 6).map((p) => (
              <button key={p.id} type="submit" name="personName" value={p.name} className="h-9 rounded-full bg-papel-2 px-3 text-[13px] font-semibold text-tinta">{p.name}</button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input name="personName" maxLength={40} placeholder={people.length ? labels.otherPersonPlaceholder : labels.firstPersonPlaceholder} aria-label={labels.personAria} autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-xl border-[1.5px] border-linha bg-papel px-3 text-base outline-none focus:border-tinta" />
          <button type="submit" className="h-11 shrink-0 rounded-full bg-tinta px-4 text-sm font-semibold text-papel">{labels.markCta}</button>
        </div>
        {erro && <p role="alert" className="text-[13px] font-medium text-vermelho-texto">{erro}</p>}
      </form>
    </details>
  );
}
