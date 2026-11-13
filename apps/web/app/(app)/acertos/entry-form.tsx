import { anotarAcerto } from './actions';

const KINDS = [
  ['emprestei', 'Emprestei'],
  ['recebi', 'Me pagou'],
  ['peguei', 'Peguei emprestado'],
  ['paguei', 'Paguei de volta'],
] as const;

/** Anotar um acerto que não passou pelo banco (dinheiro vivo, combinado de boca). */
export function EntryForm({ personId, people = [] }: { personId?: string; people?: string[] }) {
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  return (
    <form action={anotarAcerto} className="flex flex-col gap-2.5">
      {personId ? <input type="hidden" name="personId" value={personId} /> : (
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold">Com quem</span>
          <input name="personName" required maxLength={40} list="pessoas" placeholder="Ex.: Mãe, João" autoComplete="off"
            className="h-11 rounded-xl border-[1.5px] border-linha bg-papel px-3 text-base outline-none focus:border-tinta" />
          <datalist id="pessoas">{people.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
      )}
      <fieldset className="grid grid-cols-2 gap-1.5">
        <legend className="sr-only">O que aconteceu</legend>
        {KINDS.map(([v, l], i) => (
          <label key={v} className="flex h-10 cursor-pointer items-center justify-center rounded-full bg-papel-2 text-[13px] font-semibold has-[:checked]:bg-tinta has-[:checked]:text-papel">
            <input type="radio" name="kind" value={v} defaultChecked={i === 0} className="sr-only" />{l}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <label className="flex h-11 flex-1 items-center gap-1 rounded-xl border-[1.5px] border-linha bg-papel px-3 focus-within:border-tinta">
          <span className="text-sm text-tinta-suave">R$</span>
          <input name="amount" inputMode="decimal" required placeholder="0,00" aria-label="Valor" className="w-full bg-transparent text-base outline-none" />
        </label>
        <input type="date" name="occurredAt" defaultValue={hoje} aria-label="Data" className="h-11 rounded-xl border-[1.5px] border-linha bg-papel px-2 text-[14px] outline-none focus:border-tinta" />
      </div>
      <input name="description" maxLength={80} placeholder="Do que foi (opcional)" aria-label="Descrição"
        className="h-11 rounded-xl border-[1.5px] border-linha bg-papel px-3 text-base outline-none focus:border-tinta" />
      <button type="submit" className="h-11 rounded-full bg-tinta text-[15px] font-semibold text-papel">Anotar</button>
    </form>
  );
}
