'use client';
// m2-l4: Raio-x do CET no Pix, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type PixEntrada = { valorCents: number; parcelas: number; parcelaCents: number };

/** Bissecção pra achar a taxa mensal implícita i (em %) em PV = PMT * (1 - (1+i)^-n) / i. */
export function taxaMensalDoPix({ valorCents, parcelas, parcelaCents }: PixEntrada): number {
  if (parcelaCents * parcelas <= valorCents || parcelas <= 0) return 0;
  let low = 0.00001;
  let high = 2.0;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (low + high) / 2;
    const pv = parcelaCents * ((1 - Math.pow(1 + mid, -parcelas)) / mid);
    if (pv > valorCents) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return ((low + high) / 2) * 100;
}

export function calcularRaioXDoPix(entrada: PixEntrada) {
  const totalPagoCents = entrada.parcelaCents * entrada.parcelas;
  const taxaMensalPct = taxaMensalDoPix(entrada);
  return {
    totalPagoCents,
    jurosCents: totalPagoCents - entrada.valorCents,
    taxaMensalPct,
    taxaAnualPct: (Math.pow(1 + taxaMensalPct / 100, 12) - 1) * 100,
  };
}

// As três regras da régua da parcela são em reais inteiros (como sempre foram).

export const faixaDaParcela = (valorCents: number, parcelas: number) => ({
  min: Math.max(10, Math.floor(valorCents / 100 / parcelas)) * 100,
  max: (Math.ceil(((valorCents / 100) * 1.8) / parcelas) + 50) * 100,
});

/** Ao trocar o número de parcelas, sugere uma oferta com uns 15% a mais no total. */
export const parcelaSugerida = (valorCents: number, parcelas: number) =>
  Math.ceil(((valorCents / 100) * 1.15) / parcelas) * 100;

/** Ao aumentar o Pix, a parcela sobe até pelo menos cobrir o valor. */
export const parcelaMinima = (valorCents: number, parcelas: number) => Math.ceil(valorCents / 100 / parcelas) * 100;

export type PalpiteDoPix = 'ate-2' | 'de-2-a-4' | 'caro';

/** 4% ao mês é a linha do "Pix parcelado caro". */
export function palpiteCertoDoPix(taxaMensalPct: number): PalpiteDoPix {
  if (taxaMensalPct < 2) return 'ate-2';
  return taxaMensalPct < 4 ? 'de-2-a-4' : 'caro';
}

export function RaioXDoCetNoPix() {
  const [oferta, setOferta] = useState<PixEntrada>({ valorCents: 50_000, parcelas: 6, parcelaCents: 9_800 });
  const { valorCents, parcelas, parcelaCents } = oferta;
  const { totalPagoCents, jurosCents, taxaMensalPct, taxaAnualPct } = calcularRaioXDoPix(oferta);
  const juros = money(Math.max(0, jurosCents));
  const faixa = faixaDaParcela(valorCents, parcelas);

  return (
    <SimuladorShell
      pergunta="Quanto de juros por mês esse Pix parcelado cobra?"
      cenario={[
        { rotulo: 'Pix à vista', valor: money(valorCents) },
        { rotulo: 'O banco oferece', valor: `${parcelas}x de ${money(parcelaCents)}` },
      ]}
      palpites={[
        { id: 'ate-2', rotulo: 'Menos de 2% ao mês' },
        { id: 'de-2-a-4', rotulo: 'De 2% até menos de 4% ao mês' },
        { id: 'caro', rotulo: '4% ao mês ou mais' },
      ]}
      resultado={{
        rotulo: 'Taxa mensal implícita',
        valor: `${taxaMensalPct.toFixed(2).replace('.', ',')}% a.m.`,
        nota: jurosCents > 0 ? `${juros} a mais no total` : 'Nada a mais no total',
        tom: taxaMensalPct >= 4 ? 'ruim' : taxaMensalPct > 0 ? 'atencao' : 'bom',
        taxaMensalPct,
      }}
      respostaCerta={(r) => palpiteCertoDoPix(r.taxaMensalPct)}
      explicacao={
        taxaMensalPct >= 4 ? (
          <p>
            <Selo tipo="perigo" />
            <b>Pix parcelado caro:</b> o banco está cobrando <b>{taxaMensalPct.toFixed(1).replace('.', ',')}% ao mês</b>{' '}
            escondido na parcela. Só faça se for emergência real e sem alternativa à vista.
          </p>
        ) : (
          <p>
            <Selo tipo="dica" />
            <b>Compare sempre pelo CET:</b> mesmo parcelas pequenas somam juros altos no fim do contrato.
          </p>
        )
      }
      principal={
        <CampoDinheiro
          rotulo="Parcela do banco"
          valor={parcelaCents}
          // Se o Pix diminuiu depois, a parcela pode ter ficado fora da faixa: a régua se estica até ela.
          min={Math.min(faixa.min, parcelaCents)}
          max={Math.max(faixa.max, parcelaCents)}
          passo={200}
          onChange={(v) => setOferta((o) => ({ ...o, parcelaCents: v }))}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Pix de ${money(valorCents)} em ${parcelas}x`}
      extras={
        <>
          <CampoDinheiro
            rotulo="Valor do Pix à vista"
            valor={valorCents}
            min={10_000}
            max={300_000}
            passo={5_000}
            onChange={(v) =>
              setOferta((o) => ({
                ...o,
                valorCents: v,
                parcelaCents: Math.max(o.parcelaCents, parcelaMinima(v, o.parcelas)),
              }))
            }
          />
          <CampoRegua
            rotulo="Parcelas"
            valor={parcelas}
            min={2}
            max={12}
            passo={1}
            onChange={(n) => setOferta((o) => ({ ...o, parcelas: n, parcelaCents: parcelaSugerida(o.valorCents, n) }))}
            formatar={(n) => `${n}x`}
          />
        </>
      }
      detalhes={
        <Quadros
          itens={[
            { rotulo: 'Total pago no Pix', valor: money(totalPagoCents) },
            { rotulo: 'Juros embutidos', valor: juros, tom: 'ruim' },
            { rotulo: 'CET anual equivalente', valor: `${taxaAnualPct.toFixed(0)}% a.a.`, tom: 'atencao' },
          ]}
        />
      }
    />
  );
}
