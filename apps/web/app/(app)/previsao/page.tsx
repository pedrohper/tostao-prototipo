import { Visita } from '@/components/visita';
import Link from 'next/link';
import type { FinancialPlanResponse, ForecastResponse, ThisMonthForecast } from '@tostao/contracts';
import { api } from '@/lib/api';
import { money, monthName } from '@/lib/format';
import { Mascote } from '@/components/mascote';
import { BackLink, Eyebrow } from '@/components/ui';
import { BaseDiaADia } from '@/components/base-dia-a-dia';

const short = (m: string) => monthName(m).slice(0, 3);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default async function PrevisaoPage() {
  const [f, { plan }] = await Promise.all([
    api<ForecastResponse>('/forecast').catch((): ForecastResponse => ({ hasPlan: false, months: [], goal: null, thisMonth: null })),
    api<FinancialPlanResponse>('/plan').catch(() => ({ plan: null })),
  ]);

  if (!f.hasPlan || !f.months.length) {
    return (
      <div className="flex flex-col gap-3.5">
      <Visita kind="visita:previsao" />
        <BackLink href="/inicio" />
        <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Próximos meses</h1>
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-linha bg-cartao p-6 text-center">
          <Mascote pose="pensando" size={140} alt="Tostão pensando" />
          <p className="text-[15px] leading-[22px]">Pra prever, eu preciso saber quanto entra e o que sai todo mês.</p>
          <Link href="/renda" className="flex h-[50px] items-center rounded-full bg-tinta px-6 text-[15px] font-semibold text-papel no-underline">Contar minha renda</Link>
        </div>
      </div>
    );
  }

  const [first] = f.months;
  const worst = f.months.reduce((a, b) => (b.leftInCents < a.leftInCents ? b : a));
  const max = Math.max(...f.months.map((m) => Math.abs(m.leftInCents)), 1);
  const aperta = worst.leftInCents < 0;
  const sal = plan?.salary;
  const salaryNote = sal ? (sal.advance ? ` (adiantamento dia ${sal.advance.day} + resto dia ${sal.payday})` : ` (salário dia ${sal.payday})`) : '';

  return (
    <div className="flex flex-col gap-3.5">
      <Visita kind="visita:previsao" />
      <BackLink href="/inicio" />
      <h1 className="font-display text-[30px] leading-[34px] font-extrabold">Próximos meses</h1>
      {f.thisMonth && <EsteMes t={f.thisMonth} />}
      <div className={`flex items-center gap-1.5 rounded-2xl py-3 pr-3.5 pl-1.5 ${aperta ? 'bg-rosa' : 'bg-menta-clara'}`}>
        <Mascote pose={aperta ? 'preocupado' : 'comemorando'} size={76} alt={aperta ? 'Tostão preocupado' : 'Tostão comemorando'} />
        <p className="text-[15px] leading-[21px]">
          {!aperta
            ? <>Os três meses fecham no azul. Em {monthName(first.month)} devem sobrar uns <b>{money(first.leftInCents)}</b>.</>
            : worst === first
              ? <><b>{cap(monthName(first.month))} aperta</b>: faltam uns {money(-worst.leftInCents)}. Segurar o dia a dia agora resolve.</>
              : <>{cap(monthName(first.month))} {first.leftInCents >= 0 ? 'fecha no azul' : 'aperta'}, mas <b>{monthName(worst.month)} aperta{first.leftInCents < 0 ? ' mais' : ''}</b>: faltam uns {money(-worst.leftInCents)}. Segurar o dia a dia agora resolve.</>}
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-linha bg-cartao p-3.5" role="img" aria-label={f.months.map((m) => `${monthName(m.month)}: ${m.leftInCents >= 0 ? 'sobra' : 'falta'} ${money(Math.abs(m.leftInCents))}`).join('; ')}>
        {f.months.map((m) => {
          const neg = m.leftInCents < 0;
          const h = Math.max(6, Math.round((Math.abs(m.leftInCents) / max) * 52));
          return (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={`text-[13px] font-bold tabular-nums ${neg ? 'text-vermelho-texto' : 'text-verde-texto'}`}>{neg ? '− ' : '+ '}{money(Math.abs(m.leftInCents))}</span>
              <div className="flex h-[110px] w-full flex-col">
                <div className="flex h-[55px] items-end">{!neg && <div className="bar-up w-full rounded-[10px] bg-menta" style={{ height: h }} />}</div>
                <div className="h-px w-full bg-linha" />
                <div className="flex h-[55px] items-start">{neg && <div className="bar-down w-full rounded-[10px] bg-[#B42318]" style={{ height: h }} />}</div>
              </div>
              <span className="text-[13px] font-semibold">{short(m.month)}</span>
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-2">
        <Eyebrow>{cap(monthName(first.month))}, na ponta do lápis</Eyebrow>
        <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5">
          <Row label={`Renda${salaryNote}`} value={`+ ${money(first.incomeInCents)}`} />
          <Row label="Contas fixas" value={`− ${money(first.fixedInCents)}`} />
          <Row label="Assinaturas" value={`− ${money(first.subscriptionsInCents)}`} />
          <Row label="Parcelas que ainda caem" value={`− ${money(first.installmentsInCents)}`} />
          <Row label="Dia a dia (seu normal)" value={`− ${money(first.dailyInCents)}`} />
          <div className="flex min-h-12 items-center justify-between">
            <span className="text-[15px] font-bold">{first.leftInCents >= 0 ? 'Deve sobrar' : 'Deve faltar'}</span>
            <span className={`font-display text-[22px] font-extrabold tabular-nums ${first.leftInCents >= 0 ? 'text-verde-texto' : 'text-vermelho-texto'}`}>{money(Math.abs(first.leftInCents))}</span>
          </div>
        </div>
      </section>
      {f.base && <BaseDiaADia base={f.base} dailyInCents={first.dailyInCents} />}
      {first.benefitsInCents > 0 && (
        <div className="flex items-center justify-between rounded-2xl bg-amarelo-claro px-3.5 py-3 text-sm">
          <span>VR e VA <span className="text-tinta-suave">(só pra comida, fora da conta)</span></span>
          <span className="font-semibold tabular-nums">{money(first.benefitsInCents)}</span>
        </div>
      )}
      {f.goal && !f.goal.reached && f.goal.monthlyNeededInCents !== null && (
        <Link href="/meta" className={`flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm text-tinta no-underline ${f.goal.fits === false ? 'bg-rosa' : 'bg-menta-clara'}`}>
          <span>Pra meta “{f.goal.label}”</span>
          <span className="font-semibold tabular-nums">guardar {money(f.goal.monthlyNeededInCents)}/mês</span>
        </Link>
      )}
      <p className="text-xs leading-[18px] text-tinta-suave">É uma estimativa com o que você me contou e as parcelas que aparecem no cartão. Mudou algo? <Link href="/renda" className="font-semibold text-laranja-texto">Ajustar renda e contas fixas</Link>.</p>
      <Link href="/chat" className="flex h-[50px] items-center justify-center rounded-full border-[1.5px] border-tinta text-[15px] font-semibold text-tinta no-underline">Pergunte ao Tostão: dá pra comprar?</Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between border-b border-linha text-sm">
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

/** O mês que está rolando, linha por linha: de onde sai a sobra. */
function EsteMes({ t }: { t: ThisMonthForecast }) {
  const rows: [string, number][] = [
    ['Entra no mês', t.incomeInCents],
    ['Já saiu', -t.spentInCents],
    ['Contas fixas que faltam', -t.fixedLeftInCents],
    ['Assinaturas que faltam', -t.subscriptionsLeftInCents],
    [`Dia a dia (${t.daysLeft} ${t.daysLeft === 1 ? 'dia' : 'dias'})`, -t.dailyLeftInCents],
  ];
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-linha bg-cartao p-3.5">
      <Eyebrow>Até o fim de {monthName(t.month)}</Eyebrow>
      <div className="flex flex-col text-[14px]">
        {rows.filter(([, v], i) => i < 2 || v !== 0).map(([l, v]) => (
          <div key={l} className="flex justify-between border-b border-linha py-1.5"><span className="text-tinta-suave">{l}</span><span className="tabular-nums">{v < 0 ? '− ' : '+ '}{money(Math.abs(v))}</span></div>
        ))}
        <div className="flex justify-between pt-2 text-[15px] font-bold">
          <span>{t.leftInCents >= 0 ? 'Deve sobrar' : 'Deve faltar'}</span>
          <span className={`tabular-nums ${t.leftInCents >= 0 ? 'text-verde-texto' : 'text-vermelho-texto'}`}>{money(Math.abs(t.leftInCents))}</span>
        </div>
      </div>
    </section>
  );
}
