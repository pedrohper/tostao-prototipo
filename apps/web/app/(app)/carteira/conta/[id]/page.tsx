import Link from 'next/link';
import type { AccountDetailResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { ago, currentMonth, dayLabel, money, monthName, shiftMonth, shortDate } from '@/lib/format';
import { BackLink, Eyebrow } from '@/components/ui';
import { Bandeira, logosBancos, SeloBanco } from '@/components/banco';
import { Mascote } from '@/components/mascote';
import { BarrasMeses, Categorias, LimiteBarra } from '@/components/graficos';
import { Chevron, Row } from '../../transaction-row';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ContaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const hoje = currentMonth();
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? '') && sp.mes! <= hoje ? sp.mes! : hoje;
  const [d, logos] = await Promise.all([api<AccountDetailResponse>(`/accounts/${id}?month=${month}`), logosBancos()]);
  const a = d.account;
  const card = a.type === 'CREDIT';
  const fatura = Math.max(0, -a.balanceInCents);
  const parcelasFuturas = d.installments.reduce((s, i) => s + i.amountInCents * i.left, 0);
  const self = (m: string) => `/carteira/conta/${id}?mes=${m}`;
  const back = self(month);
  const groups = new Map<string, TransactionDTO[]>();
  for (const t of d.transactions) {
    const k = dayLabel(t.occurredAt);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const anterior = d.history.at(-2);
  const diff = anterior && anterior.outInCents > 0 ? d.outInCents - anterior.outInCents : null;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/carteira?mes=${month}`} label="Carteira" />

      <div className="flex items-center gap-3">
        <SeloBanco nome={a.name} instituicao={a.institution} size={48} quadrado logos={logos} />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-[28px] leading-8 font-extrabold">{a.name}</h1>
          <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-tinta-suave">{card ? 'Cartão de crédito' : 'Conta'}{a.institution ? ` · ${a.institution}` : ''}{a.lastSyncedAt ? ` · atualizado ${ago(a.lastSyncedAt)}` : ''}</span>
          {card && <Bandeira brand={a.brand} last4={a.last4} className="pt-0.5" />}
        </div>
      </div>

      {/* Número principal: fatura (cartão) ou saldo (conta) */}
      <section className={`flex flex-col gap-3 rounded-[20px] p-4 text-tinta ${card ? 'bg-[#FFE7DC] dark:bg-[#33241D]' : 'bg-menta-clara'}`}>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{card ? 'Fatura atual' : 'Saldo agora'}</span>
            <span className="font-display text-[34px] leading-10 font-extrabold tabular-nums">{money(card ? fatura : a.balanceInCents)}</span>
          </div>
          {card && a.dueDate && <span className="rounded-full bg-cartao px-3 py-1 text-[13px] font-semibold">Vence {shortDate(a.dueDate)}</span>}
        </div>
        {card && a.creditLimitInCents ? <LimiteBarra usado={fatura + parcelasFuturas} limite={a.creditLimitInCents} /> : null}
        {card && parcelasFuturas > 0 && <span className="text-[13px] text-tinta-suave">O limite usado inclui {money(parcelasFuturas)} de parcelas que ainda vão cair.</span>}
      </section>

      <div className="flex items-center justify-between rounded-full bg-papel-2 p-1">
        <Link href={self(shiftMonth(month, -1))} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center"><Chevron d="M15 18l-6-6 6-6" /></Link>
        <span className="text-[15px] font-bold capitalize">{monthName(month)} {month.slice(0, 4)}</span>
        {month < hoje
          ? <Link href={self(shiftMonth(month, 1))} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center"><Chevron d="M9 18l6-6-6-6" /></Link>
          : <span className="flex h-9 w-9 items-center justify-center text-linha" aria-hidden="true"><Chevron d="M9 18l6-6-6-6" /></span>}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-linha bg-cartao p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <Eyebrow>{card ? `Compras em ${monthName(month)}` : `Saiu em ${monthName(month)}`}</Eyebrow>
            <span className="font-display text-[26px] leading-8 font-extrabold tabular-nums">{money(d.outInCents)}</span>
          </div>
          {!card && (
            <div className="flex flex-col items-end">
              <Eyebrow>Entrou</Eyebrow>
              <span className="font-display text-[22px] leading-8 font-extrabold text-verde-texto tabular-nums">{money(d.inInCents)}</span>
            </div>
          )}
          {card && diff !== null && (
            <span className={`rounded-full px-2.5 py-1 text-[13px] font-bold text-[#1E1B18] ${diff <= 0 ? 'bg-menta' : 'bg-rosa dark:text-tinta'}`}>
              {diff <= 0 ? '↓' : '↑'} {money(Math.abs(diff))} vs {monthName(anterior!.month).slice(0, 3)}
            </span>
          )}
        </div>
        <BarrasMeses data={d.history} atual={month} entrada={!card} />
      </section>

      {d.byCategory.length > 0 && (
        <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
          <Eyebrow>Pra onde foi</Eyebrow>
          <Categorias items={d.byCategory} />
        </section>
      )}

      {card && (d.upcoming.some((u) => u.amountInCents > 0) || d.installments.length > 0) && (
        <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
          <Eyebrow>Parcelas que ainda vão cair</Eyebrow>
          <div className="grid grid-cols-3 gap-2">
            {d.upcoming.map((u) => (
              <div key={u.month} className="flex flex-col rounded-xl bg-papel-2 px-2.5 py-2">
                <span className="text-[11px] font-semibold text-tinta-suave">{cap(monthName(u.month))}</span>
                <span className="text-[15px] font-bold tabular-nums">{money(u.amountInCents)}</span>
              </div>
            ))}
          </div>
          <ul className="flex flex-col">
            {d.installments.slice(0, 8).map((i) => (
              <li key={`${i.description}${i.amountInCents}`} className="flex min-h-11 items-center gap-2 border-b border-linha text-sm last:border-b-0">
                <span className="grow truncate font-semibold">{i.description}</span>
                <span className="shrink-0 text-xs text-tinta-suave">{i.n}/{i.total} · faltam {i.left}</span>
                <span className="w-[84px] shrink-0 text-right font-semibold tabular-nums">{money(i.amountInCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col">
        <h2 className="pb-1 font-display text-xl leading-[26px] font-extrabold">{card ? 'Compras' : 'Movimentações'}</h2>
        {d.transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Mascote pose="dormindo" size={120} alt="" />
            <p className="text-[15px] text-tinta-suave">Nada {card ? 'no cartão' : 'nessa conta'} em {monthName(month)}.</p>
          </div>
        ) : [...groups.entries()].map(([day, list], i) => (
          <section key={day} className="flex flex-col">
            <h3 className={`pb-1.5 text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase ${i === 0 ? 'pt-1.5' : 'pt-3'}`}>{day}</h3>
            {list.map((t) => <Row key={t.id} t={t} back={back} />)}
          </section>
        ))}
      </section>
    </div>
  );
}
