'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  compararCompra, mensalParaAnual, mesesParaJuntar, parcelaPrice, pct, rendimento,
  type TaxasResponse,
} from '@tostao/contracts';
import { money, parseMoney } from '@/lib/format';
import { Mascote } from '@/components/mascote';

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

function Fala({ pose, tom, children }: { pose: Parameters<typeof Mascote>[0]['pose']; tom: 'menta' | 'amarelo' | 'rosa'; children: React.ReactNode }) {
  const bg = tom === 'menta' ? 'bg-menta-clara' : tom === 'rosa' ? 'bg-rosa' : 'bg-amarelo-claro';
  return (
    <div className={`flex items-center gap-1.5 rounded-2xl py-3 pr-3.5 pl-1.5 ${bg}`}>
      <Mascote pose={pose} size={68} alt="" />
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

/** Taxas médias aproximadas (Banco Central publica as médias por modalidade). Só pra começar a conta. */
const PRESETS = [
  { label: 'Rotativo do cartão', taxa: 14 },
  { label: 'Cheque especial', taxa: 8 },
  { label: 'Empréstimo pessoal', taxa: 5.5 },
  { label: 'Financiamento de carro', taxa: 2 },
  { label: 'Consignado', taxa: 1.8 },
];

export function CompensaParcelar({ taxas, compacto = false }: { taxas: TaxasResponse; compacto?: boolean }) {
  const [modo, setModo] = useState<'loja' | 'emprestimo'>('loja');
  return (
    <div className="flex flex-col gap-3.5">
      {!compacto && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-papel-2 p-1" role="tablist">
          {([['loja', 'Parcelado na loja'], ['emprestimo', 'Empréstimo']] as const).map(([m, l]) => (
            <button key={m} type="button" role="tab" aria-selected={modo === m} onClick={() => setModo(m)} className={`h-[38px] rounded-full text-sm font-semibold ${modo === m ? 'bg-tinta text-papel' : 'text-tinta'}`}>{l}</button>
          ))}
        </div>
      )}
      {modo === 'loja' ? <NaLoja taxas={taxas} compacto={compacto} /> : <Emprestimo taxas={taxas} />}
    </div>
  );
}

function NaLoja({ taxas, compacto }: { taxas: TaxasResponse; compacto: boolean }) {
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
        <Dinheiro label="Preço à vista" value={aVista} onChange={setAVista} />
        <Numero label="Parcelas" value={n} onChange={setN} sufixo="x" max={48} />
      </div>
      <Dinheiro label="Valor de cada parcela" value={parcela} onChange={setParcela} />
      {v && (
        <>
          <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5 py-1.5">
            <Linha label="Parcelado você paga">{money(v.totalParceladoInCents)}</Linha>
            <Linha label="Juros escondidos" forte>{v.jurosInCents ? money(v.jurosInCents) : 'nenhum'}</Linha>
            {v.jurosInCents > 0 && <Linha label="Taxa embutida">{pct(v.taxaMes, 2)} ao mês · {pct(v.taxaAno)} ao ano</Linha>}
          </div>
          {v.melhor === 'a-vista' && (
            <Fala pose="investigando" tom="rosa">
              <b>À vista compensa.</b> O desconto vale {pct(v.taxaAno)} ao ano, mais que os {pct(taxas.cdi)} do CDI. Deixar o dinheiro rendendo e pagar as parcelas te deixaria {money(-v.saldoParcelandoInCents)} mais pobre.
            </Fala>
          )}
          {v.melhor === 'parcelado' && (
            <Fala pose="professor" tom="menta">
              <b>Parcelar compensa, com uma condição:</b> o dinheiro do à vista fica guardado rendendo 100% do CDI e paga as parcelas. No fim sobram {money(v.saldoParcelandoInCents)}. Se você não tem o valor guardado, a conta muda: aí é parcela que come o mês que vem.
            </Fala>
          )}
          {v.melhor === 'empate' && (
            <Fala pose="pensando" tom="amarelo">
              <b>Dá praticamente na mesma.</b> A diferença é de {money(Math.abs(v.saldoParcelandoInCents))}. Escolhe pelo que te deixa mais tranquilo: à vista libera o limite e o mês que vem.
            </Fala>
          )}
          {!compacto && juntar !== null && juntar > 0 && (
            <p className="text-sm leading-5 text-tinta-suave">
              Não tem o dinheiro agora? Guardando {money(pa)} por mês rendendo o CDI, você junta os {money(av)} em <b className="text-tinta">{juntar} {juntar === 1 ? 'mês' : 'meses'}</b>{juntar < n ? `, antes da última parcela` : ''}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Emprestimo({ taxas }: { taxas: TaxasResponse }) {
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
        <Dinheiro label="Valor que você pega" value={valor} onChange={setValor} />
        <Numero label="Parcelas" value={n} onChange={setN} sufixo="x" max={120} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">Juros ao mês
        <span className="relative">
          <input inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} className={`${field} pr-10`} />
          <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-tinta-suave">%</span>
        </span>
      </label>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {PRESETS.map((x) => (
          <button key={x.label} type="button" onClick={() => setTaxa(String(x.taxa).replace('.', ','))} className={pill(taxa === String(x.taxa).replace('.', ','))}>{x.label}</button>
        ))}
      </div>
      <p className="text-xs leading-[18px] text-tinta-suave">Os botões usam médias aproximadas. No contrato, olha o CET (custo efetivo total): ele soma juros, IOF e tarifas.</p>
      {ok && (
        <>
          <div className="flex flex-col rounded-2xl border border-linha bg-cartao px-3.5 py-1.5">
            <Linha label="Cada parcela" forte>{money(p)}</Linha>
            <Linha label="Total pago">{money(total)}</Linha>
            <Linha label="Só de juros">{money(juros)}</Linha>
            <Linha label="Taxa no ano">{pct(mensalParaAnual(tx))}</Linha>
          </div>
          <Fala pose={juros > vc * 0.5 ? 'chocado' : 'professor'} tom={juros > vc * 0.5 ? 'rosa' : 'amarelo'}>
            {juros > vc * 0.5
              ? <>Você devolve <b>{(total / vc).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x</b> o que pegou. </>
              : <>Os juros somam <b>{money(juros)}</b>. </>}
            {juntar !== null && juntar > 0 && <>Se em vez de pagar parcela você guardasse {money(p)} por mês, juntava {money(vc)} em {juntar} {juntar === 1 ? 'mês' : 'meses'}. </>}
            {tx >= 0.07 && 'Dívida nessa taxa é emergência: trocar por uma mais barata (consignado, portabilidade) ou negociar vem antes de investir.'}
          </Fala>
        </>
      )}
    </div>
  );
}

// ---------- Onde investir ----------

type Passo = { id: 'divida' | 'reserva' | 'objetivos' | 'longo'; titulo: string; resumo: string; onde: string[]; licao?: { href: string; label: string } };

const PASSOS: Passo[] = [
  {
    id: 'divida', titulo: 'Sair da dívida cara', resumo: 'Rotativo e cheque especial cobram de 8% a 15% ao mês. Nenhum investimento rende isso: quitar é o melhor “investimento” que existe.',
    onde: ['Pagar ou negociar a dívida mais cara primeiro', 'Trocar por uma mais barata (consignado, portabilidade)'],
    licao: { href: '/aprender/m3-l2', label: 'Lição: qual dívida pagar antes' },
  },
  {
    id: 'reserva', titulo: 'Reserva de emergência', resumo: 'De 3 a 6 meses do que você gasta, num lugar seguro e que você saca no mesmo dia. Aqui não é pra buscar rendimento alto.',
    onde: ['Tesouro Selic (governo, saca em D+0 em dia útil)', 'CDB de liquidez diária pagando 100% do CDI ou mais, de banco coberto pelo FGC', 'Caixinha/cofrinho do banco que renda 100% do CDI'],
    licao: { href: '/aprender/m4-l2', label: 'Lição: onde guardar pra não congelar' },
  },
  {
    id: 'objetivos', titulo: 'Objetivos com data (1 a 5 anos)', resumo: 'Viagem, curso, carro, entrada de apê. Você sabe quando vai usar, então dá pra travar o dinheiro até lá e ganhar um pouco mais.',
    onde: ['CDB, LCI ou LCA com vencimento perto da data (LCI e LCA não pagam IR)', 'Tesouro Prefixado ou IPCA+ com vencimento perto da data'],
    licao: { href: '/aprender/m7-l1', label: 'Lição: emprestar pro banco (CDB)' },
  },
  {
    id: 'longo', titulo: 'Longo prazo (5 anos ou mais)', resumo: 'Aposentadoria e independência. Aqui o tempo trabalha a favor e dá pra aguentar sobe e desce, desde que você estude antes.',
    onde: ['Tesouro IPCA+ (protege da inflação)', 'Depois do módulo 8: ETF de índice amplo, aos poucos, todo mês', 'Bet, “robô”, pirâmide e dica de guru não entram em nenhum passo'],
    licao: { href: '/aprender/m8-l3', label: 'Lição: ETFs, o mercado inteiro' },
  },
];

const PRAZOS = [[6, '6 meses'], [12, '1 ano'], [24, '2 anos'], [60, '5 anos']] as const;

export type OndeInvestirProps = {
  taxas: TaxasResponse;
  /** Quanto sai num mês normal (previsão). null = ainda não sabemos. */
  gastoMensalInCents: number | null;
  /** Quanto a pessoa já tem na meta de reserva. null = a meta não é de reserva. */
  reservaGuardadaInCents: number | null;
  valorInicialInCents?: number;
};

export function OndeInvestir({ taxas, gastoMensalInCents, reservaGuardadaInCents, valorInicialInCents = 100000 }: OndeInvestirProps) {
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
  const aqui: Passo['id'] = divida ? 'divida' : faltaReserva === null || faltaReserva > 0 ? 'reserva' : 'objetivos';

  const opcoes = [
    { nome: 'Parado na conta', r: { finalInCents: v, liquidoInCents: 0 }, nota: 'não rende nada' },
    { nome: 'Poupança', r: rendimento(v, taxas.poupanca, meses, true), nota: `${pct(taxas.poupanca)} ao ano, sem IR` },
    { nome: '100% do CDI', r: rendimento(v, taxas.cdi, meses), nota: `${pct(taxas.cdi)} ao ano, menos IR` },
    // Taxa de custódia da B3 (0,2% ao ano) só passa de R$ 10 mil no Tesouro Selic
    { nome: 'Tesouro Selic', r: rendimento(v, v > 1_000_000 ? taxas.selic - 0.002 : taxas.selic, meses), nota: v > 1_000_000 ? `${pct(taxas.selic)} ao ano, menos B3 e IR` : `${pct(taxas.selic)} ao ano, menos IR` },
  ];
  const inflacao = Math.round(v * (Math.pow(1 + taxas.ipca12m, meses / 12) - 1));
  const maxGanho = Math.max(1, ...opcoes.map((o) => o.r.liquidoInCents));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[20px] border border-linha bg-cartao p-4">
        <Dinheiro label="Quanto você tem pra investir?" value={valor} onChange={setValor} />
        <Dinheiro label="Já tem guardado de reserva" value={jaTem} onChange={setJaTem} />
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Tenho dívida no rotativo ou cheque especial
          <input type="checkbox" checked={divida} onChange={(e) => setDivida(e.target.checked)} className="h-5 w-5 shrink-0 accent-[#FF5A36]" />
        </label>
      </div>

      {v > 0 && (
        <Fala pose={divida ? 'preocupado' : 'professor'} tom={divida ? 'rosa' : aqui === 'reserva' ? 'amarelo' : 'menta'}>
          {divida ? (
            <><b>Primeiro a dívida.</b> Os {money(v)} rendem uns {money(rendimento(v, taxas.cdi, 12).liquidoInCents)} num ano. A mesma grana no rotativo custa mais que isso em 2 meses. Usa pra quitar ou negociar.</>
          ) : alvo === null ? (
            <><b>Os {money(v)} vão pra reserva.</b> Ainda não sei quanto você gasta por mês, então não sei o tamanho dela. <Link href="/renda" className="font-semibold text-laranja-texto">Conta sua renda e contas</Link> que eu calculo.</>
          ) : sobra === 0 ? (
            <><b>Tudo pra reserva.</b> A sua é de {money(alvo)} (6 meses de {money(gastoMensalInCents!)}). Com esses {money(v)} ficam faltando {money(faltaReserva! - v)}.</>
          ) : praReserva > 0 ? (
            <><b>{money(praReserva)} completam a reserva</b> e os outros {money(sobra)} já podem ir pro passo 3, pensando no que você quer daqui a 1 a 5 anos.</>
          ) : (
            <><b>Reserva pronta!</b> Os {money(v)} podem ir pro passo 3 (objetivos com data) ou pro 4, se é pra daqui a muitos anos.</>
          )}
        </Fala>
      )}

      <section className="flex flex-col gap-2.5" aria-label="Passo a passo">
        {PASSOS.map((p, i) => {
          const atual = p.id === aqui;
          const feito = PASSOS.findIndex((x) => x.id === aqui) > i;
          if (p.id === 'divida' && !divida && !atual) {
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-papel-2 px-3.5 py-3 text-sm">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-menta font-bold">✓</span>
                <span><b>Sem dívida cara.</b> Pode pular o passo 1.</span>
              </div>
            );
          }
          return (
            <details key={p.id} open={atual} className={`group rounded-2xl border-2 p-3.5 ${atual ? 'border-tinta bg-cartao' : 'border-transparent bg-cartao'}`}>
              <summary className="flex cursor-pointer list-none items-center gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${atual ? 'bg-laranja text-papel' : feito ? 'bg-menta' : 'bg-papel-2'}`}>{feito ? '✓' : i + 1}</span>
                <span className="flex grow flex-col">
                  {atual && <span className="text-[11px] font-bold tracking-[0.08em] text-laranja-texto uppercase">Você tá aqui</span>}
                  <span className="text-[15px] font-bold">{p.titulo}</span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-tinta-suave transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="mt-2.5 flex flex-col gap-2 pl-10 text-sm leading-5">
                <p>{p.resumo}</p>
                {p.id === 'reserva' && alvo !== null && (
                  <div className="flex flex-col gap-1.5">
                    <div className="h-2.5 overflow-hidden rounded-full bg-papel-2" role="progressbar" aria-valuenow={Math.round((Math.min(guardado, alvo) / alvo) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Quanto da reserva já está guardado">
                      <div className="h-full rounded-full bg-menta" style={{ width: `${Math.min(100, (guardado / alvo) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-tinta-suave tabular-nums">{money(guardado)} de {money(alvo)} · 6 meses do que você gasta</span>
                  </div>
                )}
                <ul className="flex flex-col gap-1">
                  {p.onde.map((o) => <li key={o} className="flex gap-2"><span aria-hidden="true" className="text-laranja-texto">•</span><span>{o}</span></li>)}
                </ul>
                {p.licao && <Link href={p.licao.href} className="font-semibold text-laranja-texto">{p.licao.label} →</Link>}
              </div>
            </details>
          );
        })}
      </section>

      {v > 0 && (
        <section className="flex flex-col gap-2.5 rounded-[20px] border border-linha bg-cartao p-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-display text-xl font-extrabold">Quanto vira {money(v)}?</h2>
            <span className="text-xs text-tinta-suave">Líquido, já sem IR. A barra mostra quanto rendeu. Taxas de hoje, que mudam com o tempo.</span>
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
            {PRAZOS.map(([m, l]) => <button key={m} type="button" aria-pressed={meses === m} onClick={() => setMeses(m)} className={pill(meses === m)}>{l}</button>)}
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
            Pra não perder pra inflação ({pct(taxas.ipca12m)} nos últimos 12 meses), os {money(v)} precisam virar pelo menos <b className="tabular-nums">{money(v + inflacao)}</b>. Parado na conta, você perde uns {money(inflacao)} de poder de compra.
          </p>
        </section>
      )}

      <p className="text-xs leading-[18px] text-tinta-suave">
        {taxas.fonte === 'bcb' ? `Taxas do Banco Central, atualizadas em ${new Date(`${taxas.atualizadoEm}T12:00:00Z`).toLocaleDateString('pt-BR')}.` : `Não consegui falar com o Banco Central agora: usando taxas de referência de ${new Date(`${taxas.atualizadoEm}T12:00:00Z`).toLocaleDateString('pt-BR')}.`}{' '}
        O Tostão não vende investimento nem ganha comissão. Isso é educação financeira, não recomendação: confere taxa, prazo e garantia antes de aplicar.
      </p>
    </div>
  );
}
