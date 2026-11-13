import Link from 'next/link';
import type { ForecastItem, ForecastResponse } from '@tostao/contracts';
import { money, monthName, shiftMonth } from '@/lib/format';
import { ButtonLink, Eyebrow } from '@/components/ui';
import { Mascote } from '@/components/mascote';
import { Chevron } from './transaction-row';
import { SeloBanco, type Logo } from '@/components/banco';
import { BaseDiaADia } from '@/components/base-dia-a-dia';

const ROTULO: Record<ForecastItem['kind'], string> = { renda: 'Renda', conta: 'Conta fixa', assinatura: 'Assinatura', parcela: 'Parcela', anotado: 'Todo mês' };

function Linha({ i }: { i: ForecastItem }) {
  return (
    <li className="flex min-h-12 items-center gap-3 border-b border-linha last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-[10px] bg-papel-2 leading-none">
        {i.day ? <><span className="text-[9px] font-semibold text-tinta-suave uppercase">dia</span><span className="text-[14px] font-bold tabular-nums">{i.day}</span></> : <span className="text-[11px] font-bold text-tinta-suave">—</span>}
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="truncate text-[15px] font-semibold">{i.title}</span>
        <span className="text-xs text-tinta-suave">{ROTULO[i.kind]}{i.detail ? ` ${i.detail}` : ''}</span>
      </span>
      <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${i.entrada ? 'text-verde-texto' : ''}`}>{i.entrada ? '+ ' : ''}{money(i.amountInCents)}</span>
    </li>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Carteira num mês que ainda não chegou: como deve ficar, pela previsão. */
export function Simulacao({ month, hoje, forecast, logos = [] }: { month: string; hoje: string; forecast: ForecastResponse; logos?: Logo[] }) {
  const m = forecast.months.find((x) => x.month === month);
  const ultimo = shiftMonth(hoje, 3);
  const max = Math.max(1, ...forecast.months.map((x) => Math.abs(x.leftInCents)));
  const linhas: [string, number][] = m ? [
    ['Entra (renda)', m.incomeInCents],
    ['Contas fixas', -m.fixedInCents],
    ['Assinaturas', -m.subscriptionsInCents],
    ['Parcelas do cartão', -m.installmentsInCents],
    ['Anotados (todo mês e parcelas)', m.scheduledInInCents - m.scheduledOutInCents],
    ['Dia a dia (seu normal)', -m.dailyInCents],
  ] : [];
  const gastos = m ? m.fixedInCents + m.subscriptionsInCents + m.installmentsInCents + m.scheduledOutInCents + m.dailyInCents : 0;
  const fatias = m ? [
    { nome: 'Contas fixas', v: m.fixedInCents, cor: '#DCEBFF' },
    { nome: 'Assinaturas', v: m.subscriptionsInCents, cor: '#E9DDFF' },
    { nome: 'Parcelas', v: m.installmentsInCents, cor: '#FFE7DC' },
    { nome: 'Anotados', v: m.scheduledOutInCents, cor: '#DDF6E8' },
    { nome: 'Dia a dia', v: m.dailyInCents, cor: '#FFF1C7' },
  ].filter((f) => f.v > 0) : [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-[34px] leading-[38px] font-extrabold">Carteira</h1>

      <div className="flex items-center justify-between rounded-full bg-papel-2 p-1">
        <Link href={`/carteira?mes=${shiftMonth(month, -1)}`} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center"><Chevron d="M15 18l-6-6 6-6" /></Link>
        <span className="flex items-center gap-1.5 text-[15px] font-bold capitalize">{monthName(month)} {month.slice(0, 4)}<span className="rounded-full bg-amarelo px-2 py-0.5 text-[11px] font-bold text-[#1E1B18] normal-case">simulação</span></span>
        {month < ultimo
          ? <Link href={`/carteira?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center"><Chevron d="M9 18l6-6-6-6" /></Link>
          : <span className="flex h-9 w-9 items-center justify-center text-linha" aria-hidden="true"><Chevron d="M9 18l6-6-6-6" /></span>}
      </div>

      {!m ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascote pose="investigando" size={140} alt="" />
          <p className="max-w-[300px] text-[15px] text-tinta-suave">Pra simular os próximos meses eu preciso saber quanto entra e quais contas fixas você tem.</p>
          <ButtonLink href="/renda">Contar minha renda</ButtonLink>
        </div>
      ) : (
        <>
          <section className={`flex items-center gap-2 rounded-[20px] py-3 pr-4 pl-2 text-tinta ${m.leftInCents >= 0 ? 'bg-menta-clara' : 'bg-rosa'}`}>
            <Mascote pose={m.leftInCents >= 0 ? 'comemorando' : 'preocupado'} size={84} alt="" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{cap(monthName(month))}, se seguir assim</span>
              <span className="text-[15px]">{m.leftInCents >= 0 ? 'Devem sobrar uns' : 'Devem faltar uns'}</span>
              <span className="font-display text-[32px] leading-9 font-extrabold tabular-nums">{money(Math.abs(m.leftInCents))}</span>
            </div>
          </section>

          {m.cards.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">Faturas de {monthName(month)}</h2>
              {m.cards.map((c) => {
                const itens = m.items.filter((i) => i.cardId === c.id && !i.entrada);
                return (
                  <details key={c.id} className="group rounded-2xl border border-linha bg-cartao" open={m.cards.length === 1}>
                    <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
                      <SeloBanco nome={c.name} size={36} quadrado logos={logos} />
                      <span className="flex min-w-0 grow flex-col">
                        <span className="truncate text-[15px] font-semibold">{c.name}</span>
                        <span className="text-xs text-tinta-suave">{c.dueDay ? `Vence dia ${c.dueDay}` : 'Fatura prevista'} · {itens.length} {itens.length === 1 ? 'item' : 'itens'}</span>
                      </span>
                      <span className="shrink-0 font-display text-[19px] font-extrabold tabular-nums">{money(c.totalInCents)}</span>
                      <span aria-hidden="true" className="text-tinta-suave transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <ul className="flex flex-col border-t border-linha px-3.5">{itens.map((i, k) => <Linha key={`${i.title}${k}`} i={i} />)}</ul>
                  </details>
                );
              })}
              <p className="text-[12px] leading-[17px] text-tinta-suave">Só o que já dá pra saber: parcelas que faltam, assinaturas que renovam e o que você anotou no cartão. Compra nova ainda vai somar.</p>
            </section>
          )}

          {m.items.some((i) => !i.cardId && !i.entrada) && (
            <section className="flex flex-col gap-1">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">Sai da conta</h2>
              <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">{m.items.filter((i) => !i.cardId && !i.entrada).map((i, k) => <Linha key={`${i.title}${k}`} i={i} />)}</ul>
            </section>
          )}

          {m.items.some((i) => i.entrada) && (
            <section className="flex flex-col gap-1">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">Entra</h2>
              <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">{m.items.filter((i) => i.entrada).map((i, k) => <Linha key={`${i.title}${k}`} i={i} />)}</ul>
            </section>
          )}

          <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
            <Eyebrow>Na ponta do lápis</Eyebrow>
            <div className="flex flex-col text-[14px]">
              {linhas.filter(([, v], i) => i === 0 || v !== 0).map(([l, v]) => (
                <div key={l} className="flex min-h-10 items-center justify-between border-b border-linha">
                  <span>{l}</span>
                  <span className={`font-semibold tabular-nums ${v > 0 ? 'text-verde-texto' : ''}`}>{v > 0 ? '+ ' : '− '}{money(Math.abs(v))}</span>
                </div>
              ))}
              <div className="flex min-h-11 items-center justify-between font-bold">
                <span>{m.leftInCents >= 0 ? 'Sobra' : 'Falta'}</span>
                <span className="tabular-nums">{money(Math.abs(m.leftInCents))}</span>
              </div>
            </div>
            {gastos > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="flex h-3.5 overflow-hidden rounded-full bg-papel-2" role="img" aria-label={fatias.map((f) => `${f.nome} ${money(f.v)}`).join(', ')}>
                  {fatias.map((f) => <div key={f.nome} style={{ width: `${(f.v / gastos) * 100}%`, background: f.cor }} className="border-r-2 border-cartao last:border-r-0" />)}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-tinta-suave">
                  {fatias.map((f) => <span key={f.nome} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: f.cor }} />{f.nome} {Math.round((f.v / gastos) * 100)}%</span>)}
                </div>
              </div>
            )}
            {m.benefitsInCents > 0 && <p className="text-[13px] text-tinta-suave">Fora isso, entram {money(m.benefitsInCents)} de VR/VA.</p>}
          </section>

          <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
            <Eyebrow>Próximos 3 meses</Eyebrow>
            <div className="flex items-end justify-between gap-3" style={{ height: 120 }} role="img"
              aria-label={forecast.months.map((x) => `${monthName(x.month)}: ${x.leftInCents >= 0 ? 'sobra' : 'falta'} ${money(Math.abs(x.leftInCents))}`).join('; ')}>
              {forecast.months.map((x) => (
                <Link key={x.month} href={`/carteira?mes=${x.month}`} className="flex flex-1 flex-col items-center justify-end gap-1 text-tinta no-underline">
                  <span className="text-[11px] font-semibold tabular-nums">{x.leftInCents >= 0 ? '' : '−'}{money(Math.abs(x.leftInCents)).replace(/,\d\d$/, '')}</span>
                  <div className={`w-full max-w-12 rounded-t-lg ${x.leftInCents >= 0 ? 'bg-menta' : 'bg-[#FF8FA3]'} ${x.month === month ? '' : 'opacity-45'}`} style={{ height: Math.max(4, Math.round((Math.abs(x.leftInCents) / max) * 80)) }} />
                  <span className={`text-[11px] font-semibold capitalize ${x.month === month ? '' : 'text-tinta-suave'}`}>{monthName(x.month).slice(0, 3)}</span>
                </Link>
              ))}
            </div>
            <p className="text-[13px] text-tinta-suave">Verde sobra, rosa falta. Contas, assinaturas e parcelas são certas; o dia a dia é o seu normal dos últimos 3 meses.</p>
          </section>

          {forecast.base && <BaseDiaADia base={forecast.base} dailyInCents={m.dailyInCents} />}

          <div className="grid grid-cols-2 gap-2 pb-24 md:pb-0">
            <ButtonLink href="/previsao" variant="outline">Ver previsão</ButtonLink>
            <ButtonLink href="/renda" variant="outline">Ajustar renda</ButtonLink>
          </div>
        </>
      )}
    </div>
  );
}
