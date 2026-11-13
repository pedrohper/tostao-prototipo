import { logosBancos, SeloBanco } from '@/components/banco';
import Link from 'next/link';
import type { ForecastResponse, MonthSummaryResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, dayLabel, money, monthName, shiftMonth, shortDate } from '@/lib/format';
import { ButtonLink } from '@/components/ui';
import { Mascote } from '@/components/mascote';
import { Categorias } from '@/components/graficos';
import { AutoCategorizeButton } from './auto-categorize-button';
import { Simulacao } from './simulacao';
import { Chevron, Row, SearchBar } from './transaction-row';

const FILTERS = { tudo: 'Tudo', saidas: 'Saídas', entradas: 'Entradas', pendentes: 'Sem categoria' } as const;
type Filter = keyof typeof FILTERS;

export default async function CarteiraPage({ searchParams }: { searchParams: Promise<{ mes?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? sp.mes! : currentMonth();
  const filter: Filter = sp.filtro && sp.filtro in FILTERS ? (sp.filtro as Filter) : 'tudo';
  const hoje = currentMonth();
  // Mês que ainda não chegou: simulação com a previsão (até 3 meses pra frente).
  if (month > hoje) {
    const futuro = month > shiftMonth(hoje, 3) ? shiftMonth(hoje, 3) : month;
    const forecast = await api<ForecastResponse>('/forecast');
    return <Simulacao month={futuro} hoje={hoje} forecast={forecast} />;
  }

  const [{ transactions }, summary, logos] = await Promise.all([
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`),
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    logosBancos(),
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
  const mesTitulo = `${monthName(month)} ${month.slice(0, 4)}`;
  const bancos = summary.accounts.filter((a) => a.type === 'BANK');
  // Contas primeiro, cartões depois (como no design)
  const contas = [...bancos, ...summary.accounts.filter((a) => a.type === 'CREDIT')];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Carteira</h1>
        {summary.balanceInCents !== null && <span className="pb-1.5 text-[13px] font-semibold text-tinta-suave">{money(summary.balanceInCents)} em {bancos.length} {bancos.length === 1 ? 'conta' : 'contas'}</span>}
      </div>

      <SearchBar />

      <div className="flex items-center justify-between rounded-full bg-papel-2 p-1">
        <Link href={q({ mes: shiftMonth(month, -1) })} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center"><Chevron d="M15 18l-6-6 6-6" /></Link>
        <span className="text-[15px] font-bold capitalize">{mesTitulo}</span>
        <Link href={q({ mes: shiftMonth(month, 1) })} aria-label={month === hoje ? 'Simular o mês que vem' : 'Próximo mês'} className="flex h-9 w-9 items-center justify-center"><Chevron d="M9 18l6-6-6-6" /></Link>
      </div>

      {contas.length > 0 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
          {contas.map((a) => {
            const card = a.type === 'CREDIT';
            return (
              <Link key={a.id} href={`/carteira/conta/${a.id}?mes=${month}`} className={`flex w-[124px] shrink-0 flex-col gap-0.5 rounded-[14px] border px-3 py-2.5 text-tinta no-underline ${card ? 'border-[#F5CDB8] bg-[#FFF4EE] dark:border-[#5A3526] dark:bg-[#33241D]' : 'border-linha bg-cartao'}`}>
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-tinta-suave">
                  <SeloBanco nome={a.name} size={18} logos={logos} />
                  <span className="truncate">{a.name}</span>
                </span>
                <span className="text-[15px] font-bold tabular-nums">{money(card ? Math.max(0, -a.balanceInCents) : a.balanceInCents)}</span>
                <span className="truncate text-[11px] font-semibold text-tinta-suave">{card ? (a.dueDate ? `Vence ${shortDate(a.dueDate)}` : 'Fatura atual') : 'Conta'}{card && a.last4 ? ` · •• ${a.last4}` : ''} ›</span>
              </Link>
            );
          })}
        </div>
      )}

      {(summary.outcomeInCents > 0 || summary.incomeInCents > 0) && (
        <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Saiu em {monthName(month)}</span>
              <span className="font-display text-[26px] leading-8 font-extrabold tabular-nums">{money(summary.outcomeInCents)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Entrou</span>
              <span className="font-display text-[22px] leading-8 font-extrabold text-verde-texto tabular-nums">{money(summary.incomeInCents)}</span>
            </div>
          </div>
          <Categorias items={summary.byCategory} max={4} />
        </section>
      )}

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link key={f} href={q({ filtro: f })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${filter === f ? 'bg-tinta text-papel' : f === 'pendentes' && summary.uncategorizedCount > 0 ? 'bg-rosa text-tinta' : 'bg-papel-2 text-tinta'}`}>
            {f === 'pendentes' ? `${summary.uncategorizedCount} sem categoria` : FILTERS[f]}
          </Link>
        ))}
      </div>

      {filter === 'pendentes' && shown.some((t) => t.amountInCents !== 0) && <AutoCategorizeButton />}

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Mascote pose={filter === 'pendentes' ? 'caramelo-feliz' : 'dormindo'} size={140} alt="" />
          <p className="text-[15px] text-tinta-suave">{filter === 'pendentes' ? 'Tudo categorizado. O Caramelo tá orgulhoso.' : `Nada em ${monthName(month)}.`}</p>
          {transactions.length === 0 && <ButtonLink href="/conectar" variant="outline">Conectar banco</ButtonLink>}
        </div>
      ) : (
        <div className="flex flex-col">
          {[...groups.entries()].map(([day, list], i) => (
            <section key={day} className="flex flex-col">
              <h2 className={`pb-1.5 text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase ${i === 0 ? 'pt-1.5' : 'pt-3'}`}>{day}</h2>
              {list.map((t) => <Row key={t.id} t={t} back={q({})} />)}
            </section>
          ))}
        </div>
      )}

      <Link href="/anotar" className="sticky bottom-[104px] z-10 ml-auto flex h-14 items-center gap-2 rounded-full bg-tinta pr-[22px] pl-[18px] text-[15px] font-semibold text-papel no-underline shadow-[0_4px_14px_rgba(30,27,24,0.22)] md:bottom-6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Anotar gasto
      </Link>
    </div>
  );
}
