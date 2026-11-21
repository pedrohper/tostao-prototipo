import Link from 'next/link';
import type { SearchResponse } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, resolveBackHref } from '@/lib/format';
import { getI18n } from '@/lib/i18n-server';
import { BackLink, PageFrame } from '@/components/ui';
import { Mascot } from '@/components/mascote';
import { SearchBar } from '../transaction-row';
import { SearchResults } from './results';

type Period = '30d' | '3m' | '12m' | 'tudo';
type Kind = 'todas' | 'saida' | 'entrada';

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    period?: string;
    kind?: string;
    semEntreContas?: string;
    semRendimentos?: string;
    voltar?: string;
  }>;
}) {
  const [sp, { locale, t }] = await Promise.all([searchParams, getI18n()]);
  const s = t.walletExtra.search;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const period: Period = sp.period && sp.period in s.periods ? (sp.period as Period) : '12m';
  const kind: Kind = sp.kind && sp.kind in s.kinds ? (sp.kind as Kind) : 'todas';
  const hideTransfers = sp.semEntreContas === '1';
  const hideYields = sp.semRendimentos === '1';
  const backHref = resolveBackHref(sp.voltar, '/carteira');
  const searchApiParams = new URLSearchParams({ q, period, kind });
  if (hideTransfers) searchApiParams.set('excludeTransfers', '1');
  if (hideYields) searchApiParams.set('excludeYields', '1');
  const r = q ? await api<SearchResponse>(`/transactions/search?${searchApiParams}`) : null;

  const extra: Record<string, string> = sp.voltar ? { voltar: backHref } : {};
  const link = (p: Record<string, string | null | undefined>) => {
    const next: Record<string, string> = {
      q,
      period,
      kind,
      ...(hideTransfers ? { semEntreContas: '1' } : {}),
      ...(hideYields ? { semRendimentos: '1' } : {}),
      ...extra,
    };
    for (const [k, v] of Object.entries(p)) {
      if (v === null || v === undefined || v === '') delete next[k];
      else next[k] = v;
    }
    return `/carteira/busca?${new URLSearchParams(next)}`;
  };
  const back = link({});
  return (
    <PageFrame size="focused">
      <BackLink href={backHref} label={backHref === '/carteira' ? t.wallet.title : t.common.back} />
      <h1 className="font-display text-[24px] leading-[30px] font-extrabold lg:text-[28px] lg:leading-[34px]">
        {s.title}
      </h1>
      <SearchBar
        q={q}
        autoFocus={!q}
        hidden={{
          period,
          kind,
          ...(hideTransfers ? { semEntreContas: '1' } : {}),
          ...(hideYields ? { semRendimentos: '1' } : {}),
          ...extra,
        }}
        placeholder={s.placeholder}
        ariaLabel={s.ariaLabel}
      />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {(Object.keys(s.periods) as Period[]).map((p) => (
          <Link
            key={p}
            href={link({ period: p })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${period === p ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`}
          >
            {s.periods[p]}
          </Link>
        ))}
      </div>
      <div className="-mx-5 -mt-2 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
        {(Object.keys(s.kinds) as Kind[]).map((k) => (
          <Link
            key={k}
            href={link({ kind: k })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${kind === k ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`}
          >
            {s.kinds[k]}
          </Link>
        ))}
        <Link
          href={link({ semEntreContas: hideTransfers ? null : '1' })}
          aria-pressed={hideTransfers}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline transition-colors ${
            hideTransfers ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta hover:bg-papel-2'
          }`}
        >
          <span>{t.walletExtra.main.hideTransfers}</span>
          {hideTransfers && <span aria-hidden="true">✓</span>}
        </Link>
        <Link
          href={link({ semRendimentos: hideYields ? null : '1' })}
          aria-pressed={hideYields}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline transition-colors ${
            hideYields ? 'bg-tinta text-papel' : 'border border-linha bg-cartao text-tinta hover:bg-papel-2'
          }`}
        >
          <span>{t.walletExtra.main.hideYields}</span>
          {hideYields && <span aria-hidden="true">✓</span>}
        </Link>
      </div>

      {!r ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascot pose="caramelo-farejando" size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">{s.emptyHint}</p>
        </div>
      ) : r.count === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Mascot pose="caramelo-farejando" size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">
            {s.noResults(q, period === 'tudo' ? s.allHistory : s.periods[period])}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1 rounded-2xl bg-papel-2 p-4">
            <span className="text-[13px] font-semibold text-tinta-suave">{s.resultsCount(r.count, q)}</span>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {r.outInCents > 0 && (
                <span className="text-[22px] font-bold tabular-nums">
                  {money(r.outInCents)} <span className="text-[13px] font-semibold text-tinta-suave">{s.outLabel}</span>
                </span>
              )}
              {r.inInCents > 0 && (
                <span className="text-[22px] font-bold text-verde-texto tabular-nums">
                  + {money(r.inInCents)} <span className="text-[13px] font-semibold text-tinta-suave">{s.inLabel}</span>
                </span>
              )}
            </div>
          </div>
          <SearchResults
            // `key` zera a lista (e o cursor) quando a busca ou um filtro muda: sem herdar páginas da busca anterior.
            key={back}
            initial={r.transactions}
            initialCursor={r.nextCursor}
            total={r.count}
            filters={{ q, period, kind, excludeTransfers: hideTransfers, excludeYields: hideYields }}
            back={back}
            locale={locale}
          />
        </>
      )}
    </PageFrame>
  );
}
