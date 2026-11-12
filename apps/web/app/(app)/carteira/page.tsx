import Link from 'next/link';
import type { MonthSummaryResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, dayLabel, money, monthName, shiftMonth, shortDate } from '@/lib/format';
import { BankIcon, ButtonLink, CardIcon } from '@/components/ui';
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
  const bancos = summary.accounts.filter((a) => a.type === 'BANK');
  // Contas primeiro, cartões depois (como no design)
  const contas = [...bancos, ...summary.accounts.filter((a) => a.type === 'CREDIT')];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Carteira</h1>
        {summary.balanceInCents !== null && <span className="pb-1.5 text-[13px] font-semibold text-tinta-suave">{money(summary.balanceInCents)} em {bancos.length} {bancos.length === 1 ? 'conta' : 'contas'}</span>}
      </div>

      <div className="flex items-center justify-between rounded-full bg-papel-2 p-1">
        <Link href={q({ mes: shiftMonth(month, -1) })} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center"><Chevron d="M15 18l-6-6 6-6" /></Link>
        <span className="text-[15px] font-bold capitalize">{mesTitulo}</span>
        {isCurrent
          ? <span className="flex h-9 w-9 items-center justify-center text-linha" aria-hidden="true"><Chevron d="M9 18l6-6-6-6" /></span>
          : <Link href={q({ mes: shiftMonth(month, 1) })} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center"><Chevron d="M9 18l6-6-6-6" /></Link>}
      </div>

      {contas.length > 0 && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:-mx-8 md:px-8">
          {contas.map((a) => {
            const card = a.type === 'CREDIT';
            return (
              <div key={a.id} className={`flex w-[124px] shrink-0 flex-col gap-0.5 rounded-[14px] border px-3 py-2.5 ${card ? 'border-[#F5CDB8] bg-[#FFF4EE] dark:border-[#5A3526] dark:bg-[#33241D]' : 'border-linha bg-cartao'}`}>
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-tinta-suave">
                  {card ? <CardIcon className="shrink-0 text-laranja-texto" /> : <BankIcon className="shrink-0" />}
                  <span className="truncate">{a.name}</span>
                </span>
                <span className="text-[15px] font-bold tabular-nums">{money(card ? Math.max(0, -a.balanceInCents) : a.balanceInCents)}</span>
                <span className="text-[11px] font-semibold text-tinta-suave">{card ? (a.dueDate ? `Fatura · vence ${shortDate(a.dueDate)}` : 'Fatura atual') : 'Conta'}</span>
              </div>
            );
          })}
        </div>
      )}

      {summary.hiddenAccounts.length > 0 && (
        <Link href="/perfil" className="-mt-2 text-[13px] text-tinta-suave">
          {summary.hiddenAccounts.length} {summary.hiddenAccounts.length === 1 ? 'conta oculta' : 'contas ocultas'} · mostrar no Perfil
        </Link>
      )}

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <Link key={f} href={q({ filtro: f })} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold no-underline ${filter === f ? 'bg-tinta text-papel' : f === 'pendentes' && summary.uncategorizedCount > 0 ? 'bg-rosa text-tinta' : 'bg-papel-2 text-tinta'}`}>
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

function Chevron({ d }: { d: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

function Row({ t, back }: { t: TransactionDTO; back: string }) {
  const pending = !t.categoryId && !t.isInternalTransfer;
  const sub = t.categoryId === 'nao-conta' ? `Não conta · ${t.accountName ?? 'anotado na mão'}`
    : t.isInternalTransfer ? 'Entre suas contas · não conta como gasto'
    : pending ? 'Sem categoria · toque pra categorizar'
      : [t.categoryName, t.accountName ?? 'Anotado na mão'].filter(Boolean).join(' · ');
  const icon = pending ? '?' : t.isInternalTransfer ? '⇄' : t.categoryEmoji ?? (t.amountInCents > 0 ? '↓' : '↑');
  const bg = pending ? undefined : t.isInternalTransfer ? undefined : t.categoryColor ?? undefined;
  return (
    <Link href={`/carteira/${t.id}?voltar=${encodeURIComponent(back)}`}
      className={`flex min-h-[58px] items-center gap-3 border-b border-linha py-2 text-tinta no-underline last:border-b-0 ${t.isInternalTransfer ? 'opacity-60' : ''}`}>
      <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl text-lg font-bold text-[#1E1B18] ${pending ? 'bg-rosa' : bg ? '' : 'bg-papel-2'}`} style={bg ? { background: bg } : undefined} aria-hidden="true">
        {icon}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{t.description}</span>
        <span className={`truncate text-xs ${pending ? 'font-semibold text-laranja-texto' : 'text-tinta-suave'}`}>{sub}</span>
      </div>
      <span className={`shrink-0 text-[15px] tabular-nums ${t.amountInCents > 0 ? 'font-bold text-verde-texto' : 'font-semibold'}`}>
        {t.amountInCents > 0 ? '+ ' : ''}{money(Math.abs(t.amountInCents))}
      </span>
    </Link>
  );
}
