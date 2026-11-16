import Link from 'next/link';
import type { SearchResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, monthName, resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { BackLink, PageFrame } from '@/components/ui';
import { Mascot } from '@/components/mascote';
import { Row, SearchBar } from '../transaction-row';

type Period = '30d' | '3m' | '12m' | 'tudo';
type Kind = 'todas' | 'saida' | 'entrada';

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string; period?: string; kind?: string; voltar?: string }> }) {
  const [sp, { locale, t }] = await Promise.all([searchParams, getI18n()]);
  const s = t.walletExtra.search;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const period: Period = sp.period && sp.period in s.periods ? (sp.period as Period) : '12m';
  const kind: Kind = sp.kind && sp.kind in s.kinds ? (sp.kind as Kind) : 'todas';
  const backHref = resolveBackHref(sp.voltar, '/carteira');
  const r = q ? await api<SearchResponse>(`/transactions/search?${new URLSearchParams({ q, period, kind })}`) : null;

  const extra: Record<string, string> = sp.voltar ? { voltar: backHref } : {};
  const link = (p: Record<string, string>) => `/carteira/busca?${new URLSearchParams({ q, period, kind, ...extra, ...p })}`;
  const back = link({});
  const groups = new Map<string, TransactionDTO[]>();
  for (const tx of r?.transactions ?? []) {
    const m = tx.occurredAt.slice(0, 7);
    const k = `${monthName(m, locale)} ${m.slice(0, 4)}`;
    groups.set(k, [...(groups.get(k) ?? []), tx]);
  }

  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={backHref === '/carteira' ? t.wallet.title : t.common.back} />
      <h1 className="font-display text-[34px] leading-[38px] font-extrabold">{s.title}</h1>
      <SearchBar q={q} autoFocus={!q} hidden={{ period, kind, ...extra }} placeholder={s.placeholder} ariaLabel={s.ariaLabel} />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {(Object.keys(s.periods) as Period[]).map((p) => (
          <Link key={p} href={link({ period: p })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${period === p ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`}>{s.periods[p]}</Link>
        ))}
      </div>
      <div className="-mx-5 -mt-2 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {(Object.keys(s.kinds) as Kind[]).map((k) => (
          <Link key={k} href={link({ kind: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${kind === k ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`}>{s.kinds[k]}</Link>
        ))}
      </div>

      {!r ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascot pose="caramelo-farejando" size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">{s.emptyHint}</p>
        </div>
      ) : r.count === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascot pose="caramelo-farejando" size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">{s.noResults(q, period === 'tudo' ? s.allHistory : s.periods[period])}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 rounded-2xl bg-papel-2 p-4">
            <span className="text-[13px] font-semibold text-tinta-suave">{s.resultsCount(r.count, q)}</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {r.outInCents > 0 && <span className="text-[22px] font-bold tabular-nums">{money(r.outInCents)} <span className="text-[13px] font-semibold text-tinta-suave">{s.outLabel}</span></span>}
              {r.inInCents > 0 && <span className="text-[22px] font-bold text-verde-texto tabular-nums">+ {money(r.inInCents)} <span className="text-[13px] font-semibold text-tinta-suave">{s.inLabel}</span></span>}
            </div>
            {r.count > r.transactions.length && <span className="text-xs text-tinta-suave">{s.truncatedNote(r.transactions.length)}</span>}
          </div>
          <div className="flex flex-col">
            {[...groups.entries()].map(([label, list], i) => (
              <section key={label} className="flex flex-col">
                <h2 className={`pb-1.5 text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase ${i === 0 ? 'pt-1.5' : 'pt-3'}`}>{label}</h2>
                {list.map((tx) => <Row key={tx.id} t={tx} back={back} showDate locale={locale} />)}
              </section>
            ))}
          </div>
        </>
      )}
    </PageFrame>
  );
}
