import Link from 'next/link';
import type { ForecastItem, ForecastResponse } from '@tostao/contracts';
import { money, monthName, shiftMonth } from '@/lib/format';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n';
import { ButtonLink, Eyebrow, PageFrame } from '@/components/ui';
import { Mascot } from '@/components/mascote';
import { Chevron } from './transaction-row';
import { BankBadge, type BankLogo } from '@/components/banco';
import { DailySpendingBase } from '@/components/base-dia-a-dia';

function getItemKinds(locale: Locale): Record<ForecastItem['kind'], string> {
  if (locale === 'en') {
    return { renda: 'Income', conta: 'Fixed bill', assinatura: 'Subscription', parcela: 'Installment', anotado: 'Monthly' };
  }
  if (locale === 'es') {
    return { renda: 'Ingresos', conta: 'Gasto fijo', assinatura: 'Suscripción', parcela: 'Cuota', anotado: 'Cada mes' };
  }
  return { renda: 'Renda', conta: 'Conta fixa', assinatura: 'Assinatura', parcela: 'Parcela', anotado: 'Todo mês' };
}

function Linha({ i, kindLabel, dayLabel }: { i: ForecastItem; kindLabel: string; dayLabel: string }) {
  return (
    <li className="flex min-h-12 items-center gap-3 border-b border-linha last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-[10px] bg-papel-2 leading-none">
        {i.day ? <><span className="text-[9px] font-semibold text-tinta-suave uppercase">{dayLabel}</span><span className="text-[14px] font-bold tabular-nums">{i.day}</span></> : <span className="text-[11px] font-bold text-tinta-suave">—</span>}
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="truncate text-[15px] font-semibold">{i.title}</span>
        <span className="text-xs text-tinta-suave">{kindLabel}{i.detail ? ` ${i.detail}` : ''}</span>
      </span>
      <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${i.entrada ? 'text-verde-texto' : ''}`}>{i.entrada ? '+ ' : ''}{money(i.amountInCents)}</span>
    </li>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Carteira num mês que ainda não chegou: como deve ficar, pela previsão. */
export function Simulacao({
  month,
  hoje,
  forecast,
  logos = [],
  locale = 'pt-BR',
  t,
}: {
  month: string;
  hoje: string;
  forecast: ForecastResponse;
  logos?: BankLogo[];
  locale?: Locale;
  t?: Dictionary;
}) {
  const dict = t ?? getDictionary(locale);
  const p = dict.pages.previsao;
  const dLabels = dict.walletExtra.accountDetail;
  const rotulo = getItemKinds(locale);
  const m = forecast.months.find((x) => x.month === month);
  const ultimo = shiftMonth(hoje, 3);
  const max = Math.max(1, ...forecast.months.map((x) => Math.abs(x.leftInCents)));

  const copy = locale === 'en'
    ? {
        simTag: 'simulation',
        emptyHint: 'To simulate the coming months, I need to know how much comes in and your fixed bills.',
        tellIncome: p.tellIncomeCta,
        ifContinues: (mon: string) => `${cap(mon)}, if things keep going like this`,
        cardBillsOf: (mon: string) => `${mon} bills`,
        dueDay: (day: number) => `Due day ${day}`,
        expectedBill: 'Expected bill',
        itemSingular: 'item',
        itemPlural: 'items',
        cardNote: 'Only what we already know: remaining installments, renewing subscriptions, and manual entries. New purchases will add up.',
        leavesAccount: 'Leaves account',
        comesIn: 'Comes in',
        scheduledRow: 'Scheduled (monthly & installments)',
        scheduledSlice: 'Scheduled',
        benefitsNote: (val: string) => `On top of this, ${val} comes in via meal/food vouchers.`,
        next3: 'Next 3 months',
        legendNote: 'Green means leftover, pink means shortfall. Bills, subscriptions, and installments are fixed; daily spending uses your 3-month median.',
        seeForecast: 'See forecast',
        adjustIncome: 'Adjust income',
        dayWord: 'day',
      }
    : locale === 'es'
      ? {
          simTag: 'simulación',
          emptyHint: 'Para simular los próximos meses necesito saber cuánto entra y cuáles son tus gastos fijos.',
          tellIncome: p.tellIncomeCta,
          ifContinues: (mon: string) => `${cap(mon)}, si sigue así`,
          cardBillsOf: (mon: string) => `Facturas de ${mon}`,
          dueDay: (day: number) => `Vence día ${day}`,
          expectedBill: 'Factura prevista',
          itemSingular: 'ítem',
          itemPlural: 'ítems',
          cardNote: 'Solo lo que ya se sabe: cuotas pendientes, suscripciones que renuevan y lo que anotaste. Compras nuevas sumarán aparte.',
          leavesAccount: 'Sale de la cuenta',
          comesIn: 'Entra',
          scheduledRow: 'Anotados (cada mes y cuotas)',
          scheduledSlice: 'Anotados',
          benefitsNote: (val: string) => `Aparte de esto, entran ${val} en vales VR/VA.`,
          next3: 'Próximos 3 meses',
          legendNote: 'Verde sobra, rosa falta. Recibos, suscripciones y cuotas son fijos; el día a día es tu ritmo normal de los últimos 3 meses.',
          seeForecast: 'Ver previsión',
          adjustIncome: 'Ajustar ingresos',
          dayWord: 'día',
        }
      : {
          simTag: 'simulação',
          emptyHint: 'Pra simular os próximos meses eu preciso saber quanto entra e quais contas fixas você tem.',
          tellIncome: p.tellIncomeCta,
          ifContinues: (mon: string) => `${cap(mon)}, se seguir assim`,
          cardBillsOf: (mon: string) => `Faturas de ${mon}`,
          dueDay: (day: number) => `Vence dia ${day}`,
          expectedBill: 'Fatura prevista',
          itemSingular: 'item',
          itemPlural: 'itens',
          cardNote: 'Só o que já dá pra saber: parcelas que faltam, assinaturas que renovam e o que você anotou no cartão. Compra nova ainda vai somar.',
          leavesAccount: 'Sai da conta',
          comesIn: 'Entra',
          scheduledRow: 'Anotados (todo mês e parcelas)',
          scheduledSlice: 'Anotados',
          benefitsNote: (val: string) => `Fora isso, entram ${val} de VR/VA.`,
          next3: 'Próximos 3 meses',
          legendNote: 'Verde sobra, rosa falta. Contas, assinaturas e parcelas são certas; o dia a dia é o seu normal dos últimos 3 meses.',
          seeForecast: 'Ver previsão',
          adjustIncome: 'Ajustar renda',
          dayWord: 'dia',
        };

  const linhas: [string, number][] = m ? [
    [p.incomeLabel, m.incomeInCents],
    [p.fixedLabel, -m.fixedInCents],
    [p.subsLabel, -m.subscriptionsInCents],
    [p.installmentsLabel, -m.installmentsInCents],
    [copy.scheduledRow, m.scheduledInInCents - m.scheduledOutInCents],
    [p.dailyLabel, -m.dailyInCents],
  ] : [];
  const gastos = m ? m.fixedInCents + m.subscriptionsInCents + m.installmentsInCents + m.scheduledOutInCents + m.dailyInCents : 0;
  const fatias = m ? [
    { nome: p.fixedLabel, v: m.fixedInCents, cor: 'var(--color-azul)' },
    { nome: p.subsLabel, v: m.subscriptionsInCents, cor: 'var(--color-roxo-suave)' },
    { nome: p.installmentsLabel, v: m.installmentsInCents, cor: 'var(--color-laranja-claro)' },
    { nome: copy.scheduledSlice, v: m.scheduledOutInCents, cor: 'var(--color-menta-clara)' },
    { nome: p.dailyLabel, v: m.dailyInCents, cor: 'var(--color-amarelo-claro)' },
  ].filter((f) => f.v > 0) : [];

  return (
    <PageFrame size="focused">
      <h1 className="font-display text-[34px] leading-[38px] font-extrabold">{dict.wallet.title}</h1>

      <div className="flex items-center justify-between rounded-full bg-papel-2 p-1">
        <Link href={`/carteira?mes=${shiftMonth(month, -1)}`} aria-label={dLabels.prevMonth} className="flex h-9 w-9 items-center justify-center"><Chevron d="M15 18l-6-6 6-6" /></Link>
        <span className="flex items-center gap-1.5 text-[15px] font-bold capitalize">{monthName(month, locale)} {month.slice(0, 4)}<span className="rounded-full bg-amarelo px-2 py-0.5 text-[11px] font-bold text-tinta-fixa normal-case">{copy.simTag}</span></span>
        {month < ultimo
          ? <Link href={`/carteira?mes=${shiftMonth(month, 1)}`} aria-label={dLabels.nextMonth} className="flex h-9 w-9 items-center justify-center"><Chevron d="M9 18l6-6-6-6" /></Link>
          : <span className="flex h-9 w-9 items-center justify-center text-linha" aria-hidden="true"><Chevron d="M9 18l6-6-6-6" /></span>}
      </div>

      {!m ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Mascot pose="investigando" size={140} alt="" />
          <p className="max-w-[300px] text-[15px] text-tinta-suave">{copy.emptyHint}</p>
          <ButtonLink href="/renda?voltar=/carteira?mes=futuro">{copy.tellIncome}</ButtonLink>
        </div>
      ) : (
        <>
          <section className={`flex items-center gap-2 rounded-[20px] py-3 pr-4 pl-2 text-tinta ${m.leftInCents >= 0 ? 'bg-menta-clara' : 'bg-rosa'}`}>
            <Mascot pose={m.leftInCents >= 0 ? 'comemorando' : 'preocupado'} size={84} alt="" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{copy.ifContinues(monthName(month, locale))}</span>
              <span className="text-[15px]">{m.leftInCents >= 0 ? dict.engagement.shouldHaveLeftPrefix : dict.engagement.shouldBeShortPrefix}</span>
              <span className="font-display text-[32px] leading-9 font-extrabold tabular-nums">{money(Math.abs(m.leftInCents))}</span>
            </div>
          </section>

          {m.cards.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">{copy.cardBillsOf(monthName(month, locale))}</h2>
              {m.cards.map((c) => {
                const itens = m.items.filter((i) => i.cardId === c.id && !i.entrada);
                return (
                  <details key={c.id} className="group rounded-2xl border border-linha bg-cartao" open={m.cards.length === 1}>
                    <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
                      <BankBadge nome={c.name} size={36} quadrado logos={logos} />
                      <span className="flex min-w-0 grow flex-col">
                        <span className="truncate text-[15px] font-semibold">{c.name}</span>
                        <span className="text-xs text-tinta-suave">{c.dueDay ? copy.dueDay(c.dueDay) : copy.expectedBill} · {itens.length} {itens.length === 1 ? copy.itemSingular : copy.itemPlural}</span>
                      </span>
                      <span className="shrink-0 font-display text-[19px] font-extrabold tabular-nums">{money(c.totalInCents)}</span>
                      <span aria-hidden="true" className="text-tinta-suave transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <ul className="flex flex-col border-t border-linha px-3.5">{itens.map((i, k) => <Linha key={`${i.title}${k}`} i={i} kindLabel={rotulo[i.kind]} dayLabel={copy.dayWord} />)}</ul>
                  </details>
                );
              })}
              <p className="text-[12px] leading-[17px] text-tinta-suave">{copy.cardNote}</p>
            </section>
          )}

          {m.items.some((i) => !i.cardId && !i.entrada) && (
            <section className="flex flex-col gap-1">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">{copy.leavesAccount}</h2>
              <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">{m.items.filter((i) => !i.cardId && !i.entrada).map((i, k) => <Linha key={`${i.title}${k}`} i={i} kindLabel={rotulo[i.kind]} dayLabel={copy.dayWord} />)}</ul>
            </section>
          )}

          {m.items.some((i) => i.entrada) && (
            <section className="flex flex-col gap-1">
              <h2 className="font-display text-xl leading-[26px] font-extrabold">{copy.comesIn}</h2>
              <ul className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">{m.items.filter((i) => i.entrada).map((i, k) => <Linha key={`${i.title}${k}`} i={i} kindLabel={rotulo[i.kind]} dayLabel={copy.dayWord} />)}</ul>
            </section>
          )}

          <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
            <Eyebrow>{p.pencilTitle(monthName(month, locale))}</Eyebrow>
            <div className="flex flex-col text-[14px]">
              {linhas.filter(([, v], i) => i === 0 || v !== 0).map(([l, v]) => (
                <div key={l} className="flex min-h-10 items-center justify-between border-b border-linha">
                  <span>{l}</span>
                  <span className={`font-semibold tabular-nums ${v > 0 ? 'text-verde-texto' : ''}`}>{v > 0 ? '+ ' : '− '}{money(Math.abs(v))}</span>
                </div>
              ))}
              <div className="flex min-h-11 items-center justify-between font-bold">
                <span>{m.leftInCents >= 0 ? p.shouldLeft : p.shouldShort}</span>
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
            {m.benefitsInCents > 0 && <p className="text-[13px] text-tinta-suave">{copy.benefitsNote(money(m.benefitsInCents))}</p>}
          </section>

          <section className="flex flex-col gap-2.5 rounded-2xl border border-linha bg-cartao p-3.5">
            <Eyebrow>{copy.next3}</Eyebrow>
            <div className="flex items-end justify-between gap-3" style={{ height: 120 }} role="img"
              aria-label={forecast.months.map((x) => p.barAriaItem(monthName(x.month, locale), x.leftInCents >= 0, money(Math.abs(x.leftInCents)))).join('; ')}>
              {forecast.months.map((x) => (
                <Link key={x.month} href={`/carteira?mes=${x.month}`} className="flex flex-1 flex-col items-center justify-end gap-1 text-tinta no-underline">
                  <span className="text-[11px] font-semibold tabular-nums">{x.leftInCents >= 0 ? '' : '−'}{money(Math.abs(x.leftInCents)).replace(/,\d\d$/, '')}</span>
                  <div className={`w-full max-w-12 rounded-t-lg ${x.leftInCents >= 0 ? 'bg-menta' : 'bg-rosa-forte'} ${x.month === month ? '' : 'opacity-45'}`} style={{ height: Math.max(4, Math.round((Math.abs(x.leftInCents) / max) * 80)) }} />
                  <span className={`text-[11px] font-semibold capitalize ${x.month === month ? '' : 'text-tinta-suave'}`}>{monthName(x.month, locale).slice(0, 3)}</span>
                </Link>
              ))}
            </div>
            <p className="text-[13px] text-tinta-suave">{copy.legendNote}</p>
          </section>

          {forecast.base && <DailySpendingBase base={forecast.base} dailyInCents={m.dailyInCents} locale={locale} t={dict.pages.calculators.dailyBase} />}

          <div className="grid grid-cols-2 gap-2 pb-24 md:pb-0">
            <ButtonLink href="/previsao?voltar=/carteira?mes=futuro" variant="outline">{copy.seeForecast}</ButtonLink>
            <ButtonLink href="/renda?voltar=/carteira?mes=futuro" variant="outline">{copy.adjustIncome}</ButtonLink>
          </div>
        </>
      )}
    </PageFrame>
  );
}
