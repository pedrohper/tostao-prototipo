import Link from 'next/link';
import type { ForecastResponse } from '@tostao/contracts';
import { money, monthName, shiftMonth } from '@/lib/format';
import { ButtonLink, Eyebrow } from '@/components/ui';
import { Mascote } from '@/components/mascote';
import { Chevron } from './transaction-row';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Carteira num mês que ainda não chegou: como deve ficar, pela previsão. */
export function Simulacao({ month, hoje, forecast }: { month: string; hoje: string; forecast: ForecastResponse }) {
  const m = forecast.months.find((x) => x.month === month);
  const ultimo = shiftMonth(hoje, 3);
  const max = Math.max(1, ...forecast.months.map((x) => Math.abs(x.leftInCents)));
  const linhas: [string, number][] = m ? [
    ['Entra (renda)', m.incomeInCents],
    ['Contas fixas', -m.fixedInCents],
    ['Assinaturas', -m.subscriptionsInCents],
    ['Parcelas do cartão', -m.installmentsInCents],
    ['Dia a dia (média de 3 meses)', -m.dailyInCents],
  ] : [];
  const gastos = m ? m.fixedInCents + m.subscriptionsInCents + m.installmentsInCents + m.dailyInCents : 0;
  const fatias = m ? [
    { nome: 'Contas fixas', v: m.fixedInCents, cor: '#DCEBFF' },
    { nome: 'Assinaturas', v: m.subscriptionsInCents, cor: '#E9DDFF' },
    { nome: 'Parcelas', v: m.installmentsInCents, cor: '#FFE7DC' },
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
          <section className={`flex items-center gap-2 rounded-[20px] py-3 pr-4 pl-2 text-[#1E1B18] ${m.leftInCents >= 0 ? 'bg-menta-clara' : 'bg-rosa'}`}>
            <Mascote pose={m.leftInCents >= 0 ? 'comemorando' : 'preocupado'} size={84} alt="" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-[0.08em] text-[#6B635A] uppercase">{cap(monthName(month))}, se seguir assim</span>
              <span className="text-[15px]">{m.leftInCents >= 0 ? 'Devem sobrar uns' : 'Devem faltar uns'}</span>
              <span className="font-display text-[32px] leading-9 font-extrabold tabular-nums">{money(Math.abs(m.leftInCents))}</span>
            </div>
          </section>

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
            <p className="text-[13px] text-tinta-suave">Verde sobra, rosa falta. É estimativa: renda que você contou menos contas, assinaturas, parcelas já feitas e a média do dia a dia.</p>
          </section>

          <div className="grid grid-cols-2 gap-2 pb-24 md:pb-0">
            <ButtonLink href="/previsao" variant="outline">Ver previsão</ButtonLink>
            <ButtonLink href="/renda" variant="outline">Ajustar renda</ButtonLink>
          </div>
        </>
      )}
    </div>
  );
}
