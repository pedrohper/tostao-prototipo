import { todayIso } from '@/lib/format';
import { getDictionary, type Dictionary } from '@/lib/i18n';
import { anotarAcerto } from './actions';

/** Anotar um acerto que não passou pelo banco (dinheiro vivo, combinado de boca). */
export function EntryForm({
  personId,
  people = [],
  t,
}: {
  personId?: string;
  people?: string[];
  t?: Dictionary['pages']['acertos']['entryForm'];
}) {
  const labels = t ?? getDictionary('pt-BR').pages.acertos.entryForm;
  const KINDS = [
    ['emprestei', labels.kinds.emprestei],
    ['recebi', labels.kinds.recebi],
    ['peguei', labels.kinds.peguei],
    ['paguei', labels.kinds.paguei],
  ] as const;
  const hoje = todayIso();
  return (
    <form action={anotarAcerto} className="flex flex-col gap-2.5">
      {personId ? <input type="hidden" name="personId" value={personId} /> : (
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">{labels.withWhom}</span>
          <input name="personName" required maxLength={40} list="pessoas" placeholder={labels.placeholder} autoComplete="off"
            className="h-11 rounded-xl border-[1.5px] border-linha bg-papel px-3 text-base outline-none focus:border-tinta" />
          <datalist id="pessoas">{people.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
      )}
      <fieldset className="grid grid-cols-2 gap-1.5">
        <legend className="sr-only">{labels.legendAria}</legend>
        {KINDS.map(([v, l], i) => (
          <label key={v} className="flex h-10 cursor-pointer items-center justify-center rounded-full bg-papel-2 text-[13px] font-semibold has-[:checked]:bg-tinta has-[:checked]:text-papel">
            <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="sr-only" />{l}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <label className="flex h-11 flex-1 items-center gap-1 rounded-xl border-[1.5px] border-linha bg-papel px-3 focus-within:border-tinta">
          <span className="text-sm text-tinta-suave">R$</span>
          <input name="amount" inputMode="decimal" required placeholder="0,00" aria-label={labels.amountAria} className="w-full bg-transparent text-base outline-none" />
        </label>
        <input type="date" name="occurredAt" defaultValue={hoje} aria-label={labels.dateAria} className="h-11 rounded-xl border-[1.5px] border-linha bg-papel px-2 text-[14px] outline-none focus:border-tinta" />
      </div>
      <input name="description" maxLength={80} placeholder={labels.descPlaceholder} aria-label={labels.descAria}
        className="h-11 rounded-xl border-[1.5px] border-linha bg-papel px-3 text-base outline-none focus:border-tinta" />
      <button type="submit" className="h-11 rounded-full bg-tinta text-[15px] font-semibold text-papel">{labels.submit}</button>
    </form>
  );
}
