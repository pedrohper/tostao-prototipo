'use client';
// m2-l2: A bola de neve do mínimo, no SimuladorShell (T6.13). A projeção mês a mês é a de sempre, agora recebendo a
// fatura já em centavos.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type RotativoEntrada = { faturaCents: number; pctMinimo: number; taxaMensal: number };

/** Lei 14.690/2023: juros + encargos limitados a 100% do principal. */
export const tetoDaLei = (faturaCents: number) => faturaCents * 2;

export function projetarMinimo({ faturaCents, pctMinimo, taxaMensal }: RotativoEntrada, meses: number) {
  const tetoLeiCents = tetoDaLei(faturaCents);
  let saldo = faturaCents;
  let totalPago = 0;
  let bateuTeto = false;

  for (let m = 1; m <= meses; m++) {
    const pagamentoMin = Math.round((saldo * pctMinimo) / 100);
    totalPago += pagamentoMin;
    const restante = Math.max(0, saldo - pagamentoMin);
    const comJuros = Math.round(restante * (1 + taxaMensal / 100));
    if (totalPago + comJuros >= tetoLeiCents) {
      saldo = Math.max(0, tetoLeiCents - totalPago);
      bateuTeto = true;
    } else {
      saldo = comJuros;
    }
  }

  return { saldo, totalPago, totalGeral: totalPago + saldo, bateuTeto };
}

export type PalpiteDoRotativo = 'pouco' | 'meio' | 'dobro';

/** Quanto a fatura custa em 1 ano comparada ao valor dela: até 1,25x, até 1,75x, ou perto do dobro. */
export function palpiteCertoDoRotativo(faturaCents: number, totalCents: number): PalpiteDoRotativo {
  if (totalCents < faturaCents * 1.25) return 'pouco';
  return totalCents < faturaCents * 1.75 ? 'meio' : 'dobro';
}

const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

export function BolaDeNeveDoMinimo() {
  const [fatura, setFatura] = useState(80_000);
  const [pctMinimo, setPctMinimo] = useState(15);
  const [taxaMensal, setTaxaMensal] = useState(14.5); // ~14% rotativo + IOF

  const entrada = { faturaCents: fatura, pctMinimo, taxaMensal };
  const marcos = [1, 3, 6, 12].map((m) => ({ mes: m, ...projetarMinimo(entrada, m) }));
  const m12 = marcos[3]!;
  const quaseODobro = palpiteCertoDoRotativo(fatura, m12.totalGeral) === 'dobro';

  return (
    <SimuladorShell
      pergunta="Pagando só o mínimo, quanto essa fatura custa em 1 ano?"
      cenario={[
        { rotulo: 'Fatura no rotativo', valor: money(fatura) },
        { rotulo: 'Você paga por mês', valor: `${pctMinimo}% do que deve` },
        { rotulo: 'Juros + IOF por mês', valor: pct(taxaMensal) },
      ]}
      palpites={[
        { id: 'pouco', rotulo: `Pouco mais que ${money(fatura)}` },
        { id: 'meio', rotulo: `Uns ${money(Math.round(fatura * 1.5))}` },
        { id: 'dobro', rotulo: `Perto de ${money(tetoDaLei(fatura))}` },
      ]}
      resultado={{
        rotulo: 'Em 1 ano, essa fatura custa',
        valor: money(m12.totalGeral),
        nota: `${money(m12.totalPago)} já pagos + ${money(m12.saldo)} que ainda faltam`,
        tom: quaseODobro ? 'ruim' : 'atencao',
        totalCents: m12.totalGeral,
      }}
      respostaCerta={(r) => palpiteCertoDoRotativo(fatura, r.totalCents)}
      explicacao={
        <p>
          <Selo tipo="lei" />
          <b>Lei 14.690/2023 (Teto de 100%):</b> os juros do rotativo não podem passar do dobro da dívida original (
          {money(tetoDaLei(fatura))}). Em 12 meses pagando só o mínimo, você já terá desembolsado{' '}
          <b>{money(m12.totalPago)}</b> e ainda deverá <b>{money(m12.saldo)}</b>.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Fatura no rotativo"
          valor={fatura}
          min={20_000}
          max={400_000}
          passo={5_000}
          onChange={setFatura}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Pagando ${pctMinimo}% por mês, com juros de ${pct(taxaMensal)}`}
      extras={
        <>
          <CampoRegua
            rotulo="Pagamento mínimo"
            valor={pctMinimo}
            min={15}
            max={40}
            passo={5}
            onChange={setPctMinimo}
            formatar={(v) => `${v}%`}
          />
          <CampoRegua
            rotulo="Rotativo + IOF por mês"
            valor={taxaMensal}
            min={10}
            max={18}
            passo={0.5}
            onChange={setTaxaMensal}
            formatar={pct}
          />
        </>
      }
      detalhes={
        <section className="flex flex-col gap-2" aria-label="Mês a mês">
          <h3 className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">Mês a mês</h3>
          <ul className="flex flex-col divide-y divide-linha rounded-2xl border border-linha">
            {marcos.map((item) => (
              <li key={item.mes} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="flex flex-col items-start gap-1">
                  <span className="text-[13px] font-bold">Mês {item.mes}</span>
                  {item.bateuTeto && (
                    <span className="rounded-full bg-rosa px-2 py-0.5 text-xs font-bold text-vermelho-texto">
                      Teto 100%
                    </span>
                  )}
                </span>
                <span className="flex flex-col items-end">
                  <span className="font-display text-[17px] font-extrabold tabular-nums">
                    <span className="mr-1.5 font-sans text-xs font-semibold text-tinta-suave">deve</span>
                    {money(item.saldo)}
                  </span>
                  <span className="text-[13px] leading-[18px] text-tinta-suave tabular-nums">
                    já pago: {money(item.totalPago)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      }
    />
  );
}
