'use client';

import { useState, useTransition } from 'react';
import type { TransactionDTO } from '@tostao/contracts';
import { monthName } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { Row } from '../transaction-row';
import { loadMoreSearch } from './actions';

/** Lista da busca agrupada por mês, com "Carregar mais" (próxima página por cursor, sem sair da tela). */
export function SearchResults({
  initial,
  initialCursor,
  total,
  filters,
  back,
  locale,
}: {
  initial: TransactionDTO[];
  initialCursor: string | null;
  total: number;
  filters: { q: string; period: string; kind: string; excludeTransfers: boolean; excludeYields: boolean };
  back: string;
  locale: Locale;
}) {
  const s = getDictionary(locale).walletExtra.search;
  const [list, setList] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const more = () => {
    if (!cursor || pending) return;
    setFailed(false);
    start(async () => {
      const r = await loadMoreSearch({ ...filters, cursor });
      if ('error' in r) {
        setFailed(true);
        return;
      }
      // Defensivo: se uma linha já está na lista (cliques repetidos, aba antiga), não duplica.
      setList((cur) => {
        const seen = new Set(cur.map((t) => t.id));
        return [...cur, ...r.transactions.filter((t) => !seen.has(t.id))];
      });
      setCursor(r.nextCursor);
    });
  };

  const groups = new Map<string, TransactionDTO[]>();
  for (const tx of list) {
    const m = tx.occurredAt.slice(0, 7);
    const label = `${monthName(m, locale)} ${m.slice(0, 4)}`;
    groups.set(label, [...(groups.get(label) ?? []), tx]);
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {[...groups.entries()].map(([label, rows]) => (
          <section key={label} className="flex flex-col gap-1">
            <h2 className="pb-1 text-body leading-5 font-bold text-tinta">{label}</h2>
            <div className="flex flex-col">
              {rows.map((tx) => (
                <Row key={tx.id} t={tx} back={back} showDate locale={locale} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 pt-2">
        {total > list.length && (
          <span role="status" className="text-xs text-tinta-suave">
            {s.shownOfTotal(list.length, total)}
          </span>
        )}
        {failed && (
          <p role="alert" className="text-small text-red-700">
            {s.loadMoreError}
          </p>
        )}
        {cursor && (
          <button
            type="button"
            onClick={more}
            disabled={pending}
            aria-busy={pending}
            className="min-h-11 rounded-full border border-linha bg-cartao px-5 text-[14px] font-semibold text-tinta hover:bg-papel-2 disabled:opacity-60"
          >
            {pending ? s.loadingMore : s.loadMore}
          </button>
        )}
      </div>
    </>
  );
}
