import Link from 'next/link';
import type { MonthSummaryResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, dayLabel, money, monthName, shiftMonth } from '@/lib/format';
import { ButtonLink } from '@/components/ui';
import { Mascote } from '@/components/mascote';

const FILTERS = { tudo: 'Tudo', saidas: 'Saídas', entradas: 'Entradas', pendentes: 'Sem categoria' } as const;
type Filter = keyof typeof FILTERS;

export default async function CarteiraPage({ searchParams }: { searchParams: Promise<{ mes?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : currentMonth();
  const filter: Filter = sp.filtro && sp.filtro in FILTERS ? (sp.filtro as Filter) : 'tudo';

  const [{ transactions }, summary] = await Promise.all([
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`),
    api<MonthSummaryResponse>(`/summary?month=${month}`),
  ]);

  const shown = transactions.filter((t) =>
    filter === 'saidas' ? t.amountInCents < 0 && !t.isInternalTransfer
      : filter === 'entradas' ? t.amountInCents > 0 && !t.isInternalTransfer
        : filter === 'pendentes' ? !t.categoryId && !t.isInternalTransfer
          : true,
  );
  const groups = new Map<string, TransactionDTO[]>();
  for (const t of shown) {
    const k = dayLabel(t.occurredAt);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const q = (p: Record<string, string>) => `/carteira?${new URLSearchParams({ mes: month, filtro: filter, ...p })}`;
  const isCurrent = month >= currentMonth();
  const mesTitulo = `${monthName(month)} ${month.slice(0, 4)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-[28px] font-extrabold">Carteira</h1>
          {summary.balanceInCents !== null && <span className="text-sm text-tinta-suave">{money(summary.balanceInCents)} em {summary.accounts.length} contas</span>}
        </div>
        <Link href="/anotar" className="rounded-full bg-laranja px-4 py-2.5 text-sm font-bold text-[#1E1B18] no-underline">+ Anotar gasto</Link>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-cartao px-2 py-1.5">
        <Link href={q({ mes: shiftMonth(month, -1) })} aria-label="Mês anterior" className="flex h-10 w-10 items-center justify-center text-xl">‹</Link>
        <span className="font-semibold capitalize">{mesTitulo}</span>
        {isCurrent ? <span className="h-10 w-10" /> : <Link href={q({ mes: shiftMonth(month, 1) })} aria-label="Próximo mês" className="flex h-10 w-10 items-center justify-center text-xl">›</Link>}
      </div>

      {summary.accounts.length > 0 && (
        <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
          {summary.accounts.map((a) => (
            <div key={a.id} className="flex min-w-[130px] flex-col rounded-2xl bg-cartao p-3">
              <span className="text-xs font-semibold text-tinta-suave">{a.name}</span>
              <span className="font-bold">{money(a.balanceInCents)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link key={f} href={q({ filtro: f })} className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold no-underline ${filter === f ? 'bg-tinta text-papel' : 'bg-papel-2'}`}>
            {f === 'pendentes' ? `${summary.uncategorizedCount} sem categoria` : FILTERS[f]}
          </Link>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Mascote pose={filter === 'pendentes' ? 'caramelo-feliz' : 'dormindo'} size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">{filter === 'pendentes' ? 'Tudo categorizado. O Caramelo tá orgulhoso.' : `Nada em ${monthName(month)}.`}</p>
          {transactions.length === 0 && <ButtonLink href="/conectar" variant="outline">Conectar banco</ButtonLink>}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day} className="flex flex-col">
              <h2 className="pt-3 pb-1.5 text-[13px] font-semibold text-tinta-suave">{day}</h2>
              {list.map((t) => <Row key={t.id} t={t} back={q({})} />)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ t, back }: { t: TransactionDTO; back: string }) {
  const pending = !t.categoryId && !t.isInternalTransfer;
  const sub = t.isInternalTransfer ? 'Entre suas contas · não conta como gasto'
    : pending ? 'Sem categoria · toque pra categorizar'
      : [t.categoryName, t.accountName ?? 'Anotado na mão'].filter(Boolean).join(' · ');
  return (
    <Link href={`/carteira/${t.id}?voltar=${encodeURIComponent(back)}`}
      className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 no-underline ${pending ? 'bg-amarelo-claro' : ''} ${t.isInternalTransfer ? 'opacity-60' : ''}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${pending ? 'bg-amarelo' : 'bg-papel-2'}`}>
        {pending ? '?' : t.isInternalTransfer ? '⇄' : t.amountInCents > 0 ? '↓' : '↑'}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{t.description}</span>
        <span className="truncate text-xs text-tinta-suave">{sub}</span>
      </div>
      <span className={`shrink-0 text-[15px] font-bold ${t.amountInCents > 0 ? 'text-verde-texto' : ''}`}>
        {t.amountInCents > 0 ? '+ ' : ''}{money(Math.abs(t.amountInCents))}
      </span>
    </Link>
  );
}
