'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  compararCompra, mensalParaAnual, mesesParaJuntar, parcelaPrice, pct, rendimento,
  type TaxasResponse,
} from '@tostao/contracts';
import { money, parseMoney } from '@/lib/format';
import { getDictionary, type Dictionary, type Locale } from '@/lib/i18n';
import { Mascot } from '@/components/mascote';

// Simulador "Compensa parcelar?" e o guia "Onde investir".
// As contas moram em @tostao/contracts (juros.ts), com teste na API.

const field = 'h-12 w-full min-w-0 rounded-xl border-[1.5px] border-linha bg-cartao px-3.5 text-base text-tinta outline-none focus:border-tinta tabular-nums';
const pill = (on: boolean) => `shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${on ? 'bg-tinta text-papel' : 'bg-papel-2 text-tinta'}`;
const toText = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Dinheiro({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">{label}
      <span className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-tinta-suave">R$</span>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className={`${field} pl-10`} />
      </span>
    </label>
  );
}

function Numero({ label, value, onChange, sufixo, min = 1, max = 120 }: { label: string; value: number; onChange: (v: number) => void; sufixo: string; min?: number; max?: number }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">{label}
      <span className="relative">
        <input type="number" inputMode="numeric" min={min} max={max} value={value || ''} onChange={(e) => onChange(Math.max(0, Math.min(max, Math.round(+e.target.value))))} className={`${field} pr-10`} />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-tinta-suave">{sufixo}</span>
      </span>
    </label>
  );
}

function Fala({ pose, tom, children }: { pose: Parameters<typeof Mascot>[0]['pose']; tom: 'menta' | 'amarelo' | 'rosa'; children: React.ReactNode }) {
  const bg = tom === 'menta' ? 'bg-menta-clara' : tom === 'rosa' ? 'bg-rosa' : 'bg-amarelo-claro';
  return (
    <div className={`flex items-center gap-1.5 rounded-2xl py-3 pr-3.5 pl-1.5 ${bg}`}>
      <Mascot pose={pose} size={68} alt="" />
      <p className="text-[15px] leading-[21px]">{children}</p>
    </div>
  );
}

function Linha({ label, children, forte = false }: { label: string; children: React.ReactNode; forte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linha py-2 last:border-b-0">
      <span className="text-sm text-tinta-suave">{label}</span>
      <span className={`text-right whitespace-nowrap tabular-nums ${forte ? 'font-display text-lg font-extrabold' : 'text-[15px] font-semibold'}`}>{children}</span>
    </div>
  );
}

// ---------- Compensa parcelar? ----------

export function InstallmentCalculator({ taxas, compacto = false, locale = 'pt-BR', t }: {
  taxas: TaxasResponse;
  compacto?: boolean;
  locale?: Locale;
  t?: Dictionary['pages']['calculators'];
}) {
  const labels = t ?? getDictionary(locale).pages.calculators;
  const [modo, setModo] = useState<'loja' | 'emprestimo'>('loja');
  return (
    <div className="flex flex-col gap-3.5">
      {!compacto && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1" role="tablist">
          {([['loja', labels.tabStore], ['emprestimo', labels.tabLoan]] as const).map(([m, l]) => (
            <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => setModo(m)} className={`h-[38px] rounded-full text-sm font-semibold ${modo === m ? 'bg-tinta text-papel' : 'text-tinta'}`}>{l}</button>
          ))}
        </div>
      )}
      {modo === 'loja' ? <NaLoja taxas={taxas} compacto={compacto} labels={labels} /> : <Emprestimo taxas={taxas} labels={labels} />}
    </div>
  );
}

function NaLoja({ taxas, compacto, labels }: { taxas: TaxasResponse; compacto: boolean; labels: Dictionary['pages']['calculators'] }) {
  const [aVista, setAVista] = useState('900,00');
  const [parcela, setParcela] = useState('100,00');
  const [n, setN] = useState(10);
  const av = parseMoney(aVista) ?? 0;
  const pa = parseMoney(parcela) ?? 0;
  const ok = av > 0 && pa > 0 && n > 0;
  const v = ok ? compararCompra({ aVistaInCents: av, parcelaInCents: pa, parcelas: n, rendeAnual: taxas.cdi }) : null;
  const juntar = ok ? mesesParaJuntar(av, pa, taxas.cdi) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Dinheiro label={labels.cashPrice} value={aVista} onChange={setAVista} />
        <Numero label={labels.installmentsCount} value={n} onChange={setN} sufixo="x" max={48} />
      </div>
      <Dinheiro label={labels.eachInstallment} value={parcela} onChange={setParcela} />
      {v && (
        <>
          <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5 py-1.5">
            <Linha label={labels.totalParcelado}>{money(v.totalParceladoInCents)}</Linha>
            <Linha label={labels.hiddenInterest} forte>{v.jurosInCents ? money(v.jurosInCents) : labels.noneWord}</Linha>
            {v.jurosInCents > 0 && <Linha label={labels.hiddenInterest}>{labels.embeddedRate(pct(v.taxaMes, 2), pct(v.taxaAno))}</Linha>}
          </div>
          {v.melhor === 'a-vista' && (
            <Fala pose="investigando" tom="rosa">
              <b>{labels.cashWinsBefore}</b>{labels.cashWinsBody(pct(v.taxaAno), pct(taxas.cdi), money(-v.saldoParcelandoInCents))}
            </Fala>
          )}
          {v.melhor === 'parcelado' && (
            <Fala pose="professor" tom="menta">
              <b>{labels.installmentWinsBefore}</b>{labels.installmentWinsBody(money(v.saldoParcelandoInCents))}
            </Fala>
          )}
          {v.melhor === 'empate' && (
            <Fala pose="pensando" tom="amarelo">
              <b>{labels.tieBefore}</b>{labels.tieBody(money(Math.abs(v.saldoParcelandoInCents)))}
            </Fala>
          )}
          {!compacto && juntar !== null && juntar > 0 && (
            <p className="text-sm leading-5 text-tinta-suave">
              {labels.saveInsteadNote(money(pa), money(av), juntar, juntar < n)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Emprestimo({ taxas, labels }: { taxas: TaxasResponse; labels: Dictionary['pages']['calculators'] }) {
  const [valor, setValor] = useState('2.000,00');
  const [taxa, setTaxa] = useState('5,5');
  const [n, setN] = useState(12);
  const vc = parseMoney(valor) ?? 0;
  const tx = Number(taxa.replace(',', '.')) / 100;
  const ok = vc > 0 && n > 0 && Number.isFinite(tx) && tx >= 0;
  const p = ok ? parcelaPrice(vc, tx, n) : 0;
  const total = p * n;
  const juros = total - vc;
  const juntar = ok ? mesesParaJuntar(vc, p, taxas.cdi) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Dinheiro label={labels.loanAmount} value={valor} onChange={setValor} />
        <Numero label={labels.installmentsCount} value={n} onChange={setN} sufixo="x" max={120} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">{labels.monthlyInterest}
        <span className="relative">
          <input inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} className={`${field} pr-10`} />
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-tinta-suave">%</span>
        </span>
      </label>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {labels.presets.map((x) => (
          <button key={x.label} type="button" onClick={() => setTaxa(String(x.taxa).replace('.', ','))} className={pill(taxa === String(x.taxa).replace('.', ','))}>{x.label}</button>
        ))}
      </div>
      <p className="text-xs leading-[18px] text-tinta-suave">{labels.presetsNote}</p>
      {ok && (
        <>
          <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5 py-1.5">
            <Linha label={labels.eachPayment} forte>{money(p)}</Linha>
            <Linha label={labels.totalPaid}>{money(total)}</Linha>
            <Linha label={labels.interestOnly}>{money(juros)}</Linha>
            <Linha label={labels.annualRate}>{pct(mensalParaAnual(tx))}</Linha>
          </div>
          <Fala pose={juros > vc * 0.5 ? 'chocado' : 'professor'} tom={juros > vc * 0.5 ? 'rosa' : 'amarelo'}>
            {juros > vc * 0.5
              ? <>{labels.loanHeavyBefore}<b>{(total / vc).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x</b>{labels.loanHeavyMid}</>
              : <>{labels.loanNormalBefore}<b>{money(juros)}</b>. </>}
            {juntar !== null && juntar > 0 && <>{labels.loanSaveInstead(money(p), money(vc), juntar)}</>}
            {tx >= 0.07 && labels.loanEmergency}
          </Fala>
        </>
      )}
    </div>
  );
}

// ---------- Onde investir ----------

const STEP_HREFS: Record<'divida' | 'reserva' | 'objetivos' | 'longo', string> = {
  divida: '/aprender/m3-l2',
  reserva: '/aprender/m4-l2',
  objetivos: '/aprender/m7-l1',
  longo: '/aprender/m8-l3',
};

export type InvestmentComparisonProps = {
  taxas: TaxasResponse;
  /** Quanto sai num mês normal (previsão). null = ainda não sabemos. */
  gastoMensalInCents: number | null;
  /** Quanto a pessoa já tem na meta de reserva. null = a meta não é de reserva. */
  reservaGuardadaInCents: number | null;
  valorInicialInCents?: number;
  locale?: Locale;
  t?: Dictionary['pages']['calculators'];
};

export function InvestmentComparison({
  taxas,
  gastoMensalInCents,
  reservaGuardadaInCents,
  valorInicialInCents = 100000,
  locale = 'pt-BR',
  t,
}: InvestmentComparisonProps) {
  const labels = t ?? getDictionary(locale).pages.calculators;
  const [valor, setValor] = useState(toText(valorInicialInCents));
  const [jaTem, setJaTem] = useState(toText(reservaGuardadaInCents ?? 0));
  const [divida, setDivida] = useState(false);
  const [meses, setMeses] = useState(12);
  const v = parseMoney(valor) ?? 0;
  const guardado = parseMoney(jaTem) ?? 0;
  const alvo = gastoMensalInCents ? gastoMensalInCents * 6 : null;
  const faltaReserva = alvo === null ? null : Math.max(0, alvo - guardado);
  const praReserva = divida ? 0 : faltaReserva === null ? v : Math.min(v, faltaReserva);
  const sobra = divida ? 0 : v - praReserva;
  const aqui: 'divida' | 'reserva' | 'objetivos' | 'longo' = divida ? 'divida' : faltaReserva === null || faltaReserva > 0 ? 'reserva' : 'objetivos';

  const opcoes = [
    { nome: labels.optionIdle, r: { finalInCents: v, liquidoInCents: 0 }, nota: labels.optionIdleNote },
    { nome: labels.optionPoupanca, r: rendimento(v, taxas.poupanca, meses, true), nota: labels.optionPoupancaNote(pct(taxas.poupanca)) },
    { nome: labels.optionCdi, r: rendimento(v, taxas.cdi, meses), nota: labels.optionCdiNote(pct(taxas.cdi)) },
    // Taxa de custódia da B3 (0,2% ao ano) só passa de R$ 10 mil no Tesouro Selic
    {
      nome: labels.optionSelic,
      r: rendimento(v, v > 1_000_000 ? taxas.selic - 0.002 : taxas.selic, meses),
      nota: v > 1_000_000 ? labels.optionSelicNoteB3(pct(taxas.selic)) : labels.optionSelicNote(pct(taxas.selic)),
    },
  ];
  const inflacao = Math.round(v * (Math.pow(1 + taxas.ipca12m, meses / 12) - 1));
  const maxGanho = Math.max(1, ...opcoes.map((o) => o.r.liquidoInCents));
  const dateText = new Date(`${taxas.atualizadoEm}T12:00:00Z`).toLocaleDateString(locale);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
        <Dinheiro label={labels.investHowMuch} value={valor} onChange={setValor} />
        <Dinheiro label={labels.investAlreadyReserved} value={jaTem} onChange={setJaTem} />
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          {labels.hasExpensiveDebt}
          <input type="checkbox" checked={divida} onChange={(e) => setDivida(e.target.checked)} className="h-5 w-5 shrink-0 accent-laranja" />
        </label>
      </div>

      {v > 0 && (
        <Fala pose={divida ? 'preocupado' : 'professor'} tom={divida ? 'rosa' : aqui === 'reserva' ? 'amarelo' : 'menta'}>
          {divida ? (
            <>{labels.adviceDebt(money(v), money(rendimento(v, taxas.cdi, 12).liquidoInCents))}</>
          ) : alvo === null ? (
            <>{labels.adviceNoIncomeBefore(money(v))}<Link href="/renda" className="font-semibold text-laranja-texto">{labels.adviceNoIncomeLink}</Link>{labels.adviceNoIncomeAfter}</>
          ) : sobra === 0 ? (
            <>{labels.adviceAllReserve(money(alvo), money(gastoMensalInCents!), money(v), money(faltaReserva! - v))}</>
          ) : praReserva > 0 ? (
            <>{labels.adviceSplitReserve(money(praReserva), money(sobra))}</>
          ) : (
            <>{labels.adviceReserveReady(money(v))}</>
          )}
        </Fala>
      )}

      <section className="flex flex-col gap-2.5" aria-label={labels.stepByStepAria}>
        {labels.steps.map((p, i) => {
          const atual = p.id === aqui;
          const feito = labels.steps.findIndex((x) => x.id === aqui) > i;
          if (p.id === 'divida' && !divida && !atual) {
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-papel-2 px-3.5 py-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-menta font-bold">✓</span>
                <span>{labels.noDebtSkip}</span>
              </div>
            );
          }
          return (
            <details key={p.id} open={atual} className={`group rounded-2xl border-2 p-3.5 ${atual ? 'border-tinta bg-cartao' : 'border-transparent bg-cartao'}`}>
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${atual ? 'bg-laranja text-papel' : feito ? 'bg-menta' : 'bg-papel-2'}`}>{feito ? '✓' : i + 1}</span>
                <span className="flex grow flex-col">
                  {atual && <span className="text-[11px] font-bold tracking-[0.08em] text-laranja-texto uppercase">{labels.youAreHere}</span>}
                  <span className="text-[15px] font-bold">{p.title}</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-tinta-suave transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="mt-2.5 flex flex-col gap-2 pl-10 text-sm leading-5">
                <p>{p.summary}</p>
                {p.id === 'reserva' && alvo !== null && (
                  <div className="flex flex-col gap-1.5">
                    <div className="h-2.5 overflow-hidden rounded-full bg-papel-2" role="progressbar" aria-valuenow={Math.round((Math.min(guardado, alvo) / alvo) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={labels.reserveProgressAria}>
                      <div className="h-full rounded-full bg-menta" style={{ width: `${Math.min(100, (guardado / alvo) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-tinta-suave tabular-nums">{labels.reserveProgressText(money(guardado), money(alvo))}</span>
                  </div>
                )}
                <ul className="flex flex-col gap-1">
                  {p.where.map((o) => <li key={o} className="flex gap-2"><span aria-hidden="true" className="text-laranja-texto">•</span><span>{o}</span></li>)}
                </ul>
                <Link href={STEP_HREFS[p.id]} className="font-semibold text-laranja-texto">{p.lessonLabel} →</Link>
              </div>
            </details>
          );
        })}
      </section>

      {v > 0 && (
        <section className="flex flex-col gap-2.5 rounded-[20px] border border-linha bg-cartao p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-xl font-extrabold">{labels.howMuchBecomes(money(v))}</h2>
            <span className="text-xs text-tinta-suave">{labels.netAfterTaxNote}</span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
            {labels.terms.map(([m, l]) => <button key={m} type="button" aria-pressed={meses === m} onClick={() => setMeses(m)} className={pill(meses === m)}>{l}</button>)}
          </div>
          <ul className="flex flex-col gap-2.5">
            {opcoes.map((o) => (
              <li key={o.nome} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{o.nome}</span>
                  <span className="text-[15px] font-bold whitespace-nowrap tabular-nums">{money(o.r.finalInCents)}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-papel-2"><span className="block h-full rounded-full bg-menta" style={{ width: `${Math.max(0, o.r.liquidoInCents / maxGanho) * 100}%` }} /></span>
                <span className="flex justify-between gap-2 text-xs text-tinta-suave"><span>{o.nota}</span><span className="whitespace-nowrap tabular-nums">{o.r.liquidoInCents > 0 ? `+${money(o.r.liquidoInCents)}` : ''}</span></span>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-5">
            {labels.inflationNote(pct(taxas.ipca12m), money(v), money(v + inflacao), money(inflacao))}
          </p>
        </section>
      )}

      <p className="text-xs leading-[18px] text-tinta-suave">
        {taxas.fonte === 'bcb' ? labels.bcbSource(dateText) : labels.fallbackSource(dateText)}{' '}
        {labels.disclaimer}
      </p>
    </div>
  );
}
