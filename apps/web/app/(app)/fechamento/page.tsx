import Link from 'next/link';
import type { MonthSummaryResponse, SubscriptionsResponse, TransactionDTO } from '@tostao/contracts';
import { api } from '@/lib/api';
import { currentMonth, money, monthName, shiftMonth } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { BackLink, Card } from '@/components/ui';

const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

function Delta({ now, before, goodWhenDown = true }: { now: number; before: number; goodWhenDown?: boolean }) {
  const p = pct(now, before);
  if (p === null || p === 0) return <span className="text-[13px] text-tinta-suave">igual ao mês anterior</span>;
  const good = goodWhenDown ? p < 0 : p > 0;
  return <span className={`text-[13px] font-semibold ${good ? 'text-verde-texto' : 'text-vermelho-texto'}`}>{p > 0 ? '▲' : '▼'} {Math.abs(p)}% vs mês anterior</span>;
}

/** Fechamento: o resumo do mês que passou, comparado com o anterior. Padrão: o último mês fechado. */
export default async function FechamentoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const month = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : shiftMonth(currentMonth(), -1);
  const before = shiftMonth(month, -1);
  const [s, p, { transactions }, subs] = await Promise.all([
    api<MonthSummaryResponse>(`/summary?month=${month}`),
    api<MonthSummaryResponse>(`/summary?month=${before}`),
    api<{ transactions: TransactionDTO[] }>(`/transactions?month=${month}`),
    api<SubscriptionsResponse>('/subscriptions').catch(() => null),
  ]);

  const sobrou = s.incomeInCents - s.outcomeInCents;
  const biggest = transactions.filter((t) => t.amountInCents < 0 && !t.isInternalTransfer).sort((a, b) => a.amountInCents - b.amountInCents)[0];
  const prevByCat = new Map(p.byCategory.map((c) => [c.categoryId, c.totalInCents]));
  const top = s.byCategory.slice(0, 4);
  const vazio = s.incomeInCents === 0 && s.outcomeInCents === 0;
  const nome = monthName(month);
  const isCurrent = month === currentMonth();

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/inicio" />
      <div className="flex items-center justify-between gap-2">
        <Link href={`/fechamento?mes=${before}`} aria-label="Mês anterior" className="flex h-11 w-11 items-center justify-center rounded-full bg-cartao text-xl no-underline">‹</Link>
        <div className="text-center">
          <span className="text-[13px] font-semibold text-tinta-suave">Fechamento</span>
          <h1 className="font-display text-[28px] leading-tight font-extrabold capitalize">{nome} {month.slice(0, 4)}</h1>
          {isCurrent && <span className="text-[13px] text-tinta-suave">mês ainda aberto</span>}
        </div>
        {isCurrent ? <span className="h-11 w-11" /> : <Link href={`/fechamento?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês" className="flex h-11 w-11 items-center justify-center rounded-full bg-cartao text-xl no-underline">›</Link>}
      </div>

      {vazio ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascote pose="dormindo" size={150} alt="Tostão dormindo" />
          <p className="text-[15px] text-tinta-suave">Não tenho nada de {nome}. Meu extrato começa depois disso.</p>
        </Card>
      ) : (
        <>
          <div className={`flex items-center gap-3 rounded-3xl p-4 text-[#1E1B18] ${sobrou >= 0 ? 'bg-menta' : 'bg-amarelo'}`}>
            <Mascote pose={sobrou >= 0 ? 'comemorando' : 'sem-graca'} size={88} alt={sobrou >= 0 ? 'Tostão comemorando' : 'Tostão sem graça'} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{sobrou >= 0 ? 'Sobrou' : 'Faltou'}</span>
              <span className="font-display text-[34px] leading-tight font-extrabold">{money(Math.abs(sobrou))}</span>
              <span className="text-[14px] leading-snug">{sobrou >= 0 ? 'Fechou no azul. Se der, separa um pedaço disso antes de gastar.' : 'Saiu mais do que entrou. Acontece, bora ver onde apertou.'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Card className="flex flex-col gap-0.5"><span className="text-xs font-semibold">Entrou</span><span className="text-[19px] font-bold">+ {money(s.incomeInCents)}</span><Delta now={s.incomeInCents} before={p.incomeInCents} goodWhenDown={false} /></Card>
            <Card className="flex flex-col gap-0.5"><span className="text-xs font-semibold">Saiu</span><span className="text-[19px] font-bold">{money(s.outcomeInCents)}</span><Delta now={s.outcomeInCents} before={p.outcomeInCents} /></Card>
          </div>

          {top.length > 0 && (
            <Card>
              <h2 className="mb-3 font-display text-xl font-extrabold">Onde mais foi</h2>
              <div className="flex flex-col divide-y divide-linha">
                {top.map((c) => (
                  <div key={c.categoryId ?? 'sem'} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex flex-col"><span className="font-semibold">{c.name}</span><Delta now={c.totalInCents} before={prevByCat.get(c.categoryId) ?? 0} /></div>
                    <span className="font-bold">{money(c.totalInCents)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {biggest && (
            <Card className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-tinta-suave">Maior gasto do mês</span>
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold [overflow-wrap:anywhere]">{biggest.description}</span>
                <span className="shrink-0 font-bold">{money(-biggest.amountInCents)}</span>
              </div>
            </Card>
          )}

          {subs && subs.monthlyInCents > 0 && (
            <Link href="/assinaturas" className="flex items-center gap-3 rounded-[20px] bg-amarelo-claro p-3 no-underline">
              <Mascote pose="investigando" size={56} alt="" />
              <p className="text-[15px] leading-snug">Desse total, <b>{money(subs.monthlyInCents)}</b> são assinaturas que cobram sozinhas todo mês.</p>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
