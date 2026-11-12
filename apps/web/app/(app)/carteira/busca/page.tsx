import Link from 'next/link';
import type { SearchResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, monthName } from '@/lib/format';
import { BackLink } from '@/components/ui';
import { Mascote } from '@/components/mascote';
import { Row, SearchBar } from '../transaction-row';

const PERIODS = { '30d': '30 dias', '3m': '3 meses', '12m': '12 meses', tudo: 'Tudo' } as const;
const KINDS = { todas: 'Saídas e entradas', saida: 'Só saídas', entrada: 'Só entradas' } as const;
type Period = keyof typeof PERIODS;
type Kind = keyof typeof KINDS;

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string; period?: string; kind?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const period: Period = sp.period && sp.period in PERIODS ? (sp.period as Period) : '12m';
  const kind: Kind = sp.kind && sp.kind in KINDS ? (sp.kind as Kind) : 'todas';
  const r = q ? await api<SearchResponse>(`/transactions/search?${new URLSearchParams({ q, period, kind })}`) : null;

  const link = (p: Record<string, string>) => `/carteira/busca?${new URLSearchParams({ q, period, kind, ...p })}`;
  const back = link({});
  const groups = new Map<string, TransactionDTO[]>();
  for (const t of r?.transactions ?? []) {
    const m = t.occurredAt.slice(0, 7);
    const k = `${monthName(m)} ${m.slice(0, 4)}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/carteira" label="Carteira" />
      <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Buscar</h1>
      <SearchBar q={q} autoFocus={!q} hidden={{ period, kind }} />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <Link key={p} href={link({ period: p })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${period === p ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`}>{PERIODS[p]}</Link>
        ))}
      </div>
      <div className="-mx-5 -mt-2 flex gap-2 overflow-x-auto px-5">
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <Link key={k} href={link({ kind: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${kind === k ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`}>{KINDS[k]}</Link>
        ))}
      </div>

      {!r ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascote pose="caramelo-farejando" size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">Procura por loja (“ifood”), pessoa (“dani”), categoria ou banco. Eu somo tudo que achar.</p>
        </div>
      ) : r.count === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascote pose="caramelo-farejando" size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">Não achei nada com “{q}” em {period === 'tudo' ? 'todo o histórico' : `${PERIODS[period]}`}.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 rounded-2xl bg-papel-2 p-4">
            <span className="text-[13px] font-semibold text-tinta-suave">{r.count} {r.count === 1 ? 'lançamento' : 'lançamentos'} com “{q}”</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {r.outInCents > 0 && <span className="text-[22px] font-bold tabular-nums">{money(r.outInCents)} <span className="text-[13px] font-semibold text-tinta-suave">saiu</span></span>}
              {r.inInCents > 0 && <span className="text-[22px] font-bold text-verde-texto tabular-nums">+ {money(r.inInCents)} <span className="text-[13px] font-semibold text-tinta-suave">entrou</span></span>}
            </div>
            {r.count > r.transactions.length && <span className="text-xs text-tinta-suave">Mostrando os {r.transactions.length} mais recentes. A soma conta todos.</span>}
          </div>
          <div className="flex flex-col">
            {[...groups.entries()].map(([label, list], i) => (
              <section key={label} className="flex flex-col">
                <h2 className={`pb-1.5 text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase ${i === 0 ? 'pt-1.5' : 'pt-3'}`}>{label}</h2>
                {list.map((t) => <Row key={t.id} t={t} back={back} showDate />)}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
