import { money, monthName } from '@/lib/format';

const curto = (m: string) => monthName(m).slice(0, 3);
/** "R$ 1,2 mil" pra caber em cima da barra. */
const compacto = (cents: number) => {
  const r = cents / 100;
  if (r >= 1000) return `${(r / 1000).toFixed(r >= 10000 ? 0 : 1).replace('.', ',')} mil`;
  return `${Math.round(r)}`;
};

/** Barras por mês. Com `entrada`, mostra entrou (menta) e saiu (laranja) lado a lado. */
export function BarrasMeses({ data, atual, entrada = false, altura = 112 }: {
  data: { month: string; outInCents: number; inInCents?: number }[];
  atual: string;
  entrada?: boolean;
  altura?: number;
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.outInCents, entrada ? d.inInCents ?? 0 : 0)));
  const h = (v: number) => (v > 0 ? Math.max(3, Math.round((v / max) * altura)) : 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-1.5" style={{ height: altura + 18 }} role="img"
        aria-label={data.map((d) => `${monthName(d.month)}: saiu ${money(d.outInCents)}${entrada ? `, entrou ${money(d.inInCents ?? 0)}` : ''}`).join('; ')}>
        {data.map((d) => {
          const on = d.month === atual;
          return (
            <div key={d.month} className="flex flex-1 flex-col items-center justify-end gap-1">
              {!entrada && <span className={`text-[10px] font-semibold tabular-nums ${on ? 'text-tinta' : 'text-tinta-suave'}`}>{d.outInCents > 0 ? compacto(d.outInCents) : ''}</span>}
              <div className="flex w-full items-end justify-center gap-[3px]">
                {entrada && <div className={`w-[42%] max-w-4 rounded-t-[5px] bg-menta ${on ? '' : 'opacity-50'}`} style={{ height: h(d.inInCents ?? 0) }} />}
                <div className={`${entrada ? 'w-[42%] max-w-4' : 'w-full max-w-9'} rounded-t-[6px] ${on ? 'bg-laranja' : 'bg-laranja/35'}`} style={{ height: h(d.outInCents) }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-1.5 border-t border-linha pt-1.5">
        {data.map((d) => <span key={d.month} className={`flex-1 text-center text-[11px] font-semibold capitalize ${d.month === atual ? 'text-tinta' : 'text-tinta-suave'}`}>{curto(d.month)}</span>)}
      </div>
      {entrada && (
        <div className="flex gap-3 text-[11px] font-semibold text-tinta-suave">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-menta" />Entrou</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-laranja" />Saiu</span>
        </div>
      )}
    </div>
  );
}

/** Barra empilhada + lista: pra onde foi o dinheiro. */
export function Categorias({ items, max = 6 }: { items: { categoryId: string | null; name: string; color: string; totalInCents: number }[]; max?: number }) {
  const total = items.reduce((s, c) => s + c.totalInCents, 0);
  if (!total) return null;
  const top = items.slice(0, max);
  const resto = items.slice(max).reduce((s, c) => s + c.totalInCents, 0);
  const lista = resto > 0 ? [...top, { categoryId: '_resto', name: 'Outras', color: '#E4DCCF', totalInCents: resto }] : top;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-3.5 overflow-hidden rounded-full bg-papel-2" role="img" aria-label={lista.map((c) => `${c.name} ${Math.round((c.totalInCents / total) * 100)}%`).join(', ')}>
        {lista.map((c) => <div key={c.categoryId ?? 'sem'} style={{ width: `${(c.totalInCents / total) * 100}%`, background: c.categoryId ? c.color : '#FFB4C2' }} className="border-r-2 border-cartao last:border-r-0" />)}
      </div>
      <ul className="flex flex-col">
        {lista.map((c) => (
          <li key={c.categoryId ?? 'sem'} className="flex min-h-8 items-center gap-2 text-sm">
            <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.categoryId ? c.color : '#FFB4C2' }} />
            <span className="grow truncate">{c.name}</span>
            <span className="text-xs text-tinta-suave tabular-nums">{Math.round((c.totalInCents / total) * 100)}%</span>
            <span className="w-[92px] text-right font-semibold tabular-nums">{money(c.totalInCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Limite do cartão: quanto já foi usado. */
export function LimiteBarra({ usado, limite }: { usado: number; limite: number }) {
  const pct = Math.min(100, Math.round((usado / Math.max(1, limite)) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2.5 overflow-hidden rounded-full bg-papel-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Limite usado">
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-[#E5484D]' : pct >= 70 ? 'bg-amarelo' : 'bg-menta'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-tinta-suave">
        <span>Usado {money(usado)} ({pct}%)</span>
        <span>Livre {money(Math.max(0, limite - usado))}</span>
      </div>
    </div>
  );
}
