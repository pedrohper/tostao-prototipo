'use client';
// m8-l2: Renda passiva em FIIs, no SimuladorShell (T6.15). A conta é a de sempre, agora com a meta em centavos desde a
// entrada.
import { useState } from 'react';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export const PRECO_DA_COTA_CENTS = 10_000;

export function calcularRendaDeFiis({ metaCents, dyPct }: { metaCents: number; dyPct: number }) {
  const meta = metaCents / 100;
  const precoCota = PRECO_DA_COTA_CENTS / 100;
  const dividendoPorCota = precoCota * (dyPct / 100);
  const cotas = Math.ceil(meta / dividendoPorCota);
  const capitalCents = cotas * PRECO_DA_COTA_CENTS;
  return { dividendoPorCotaCents: Math.round(dividendoPorCota * 100), cotas, capitalCents };
}

export type PalpiteDosFiis = 'pouco' | 'medio' | 'muito';

/** Fronteiras dos palpites: 20 e 80 vezes a renda mensal. */
export const faixasDosFiis = (metaCents: number) => ({ poucoCents: metaCents * 20, muitoCents: metaCents * 80 });

export function palpiteCertoDosFiis(metaCents: number, capitalCents: number): PalpiteDosFiis {
  const { poucoCents, muitoCents } = faixasDosFiis(metaCents);
  if (capitalCents <= poucoCents) return 'pouco';
  return capitalCents <= muitoCents ? 'medio' : 'muito';
}

const pctDy = (v: number) => `${v.toFixed(2).replace('.', ',')}%`;

export function RendaPassivaFIIs() {
  const [meta, setMeta] = useState(10_000);
  const [dy, setDy] = useState(0.85);

  const { dividendoPorCotaCents, cotas, capitalCents } = calcularRendaDeFiis({ metaCents: meta, dyPct: dy });
  const { poucoCents, muitoCents } = faixasDosFiis(meta);

  return (
    <SimuladorShell
      pergunta="Pra essa renda pingar todo mês, quanto precisa estar investido?"
      cenario={[
        { rotulo: 'Renda que você quer por mês', valor: money(meta) },
        { rotulo: 'Preço de cada cota', valor: money(PRECO_DA_COTA_CENTS) },
        { rotulo: 'Cada cota paga por mês', valor: money(dividendoPorCotaCents) },
      ]}
      palpites={[
        { id: 'pouco', rotulo: `Até ${money(poucoCents)}` },
        { id: 'medio', rotulo: `Entre ${money(poucoCents)} e ${money(muitoCents)}` },
        { id: 'muito', rotulo: `Mais de ${money(muitoCents)}` },
      ]}
      resultado={{
        rotulo: 'Capital acumulado pra gerar a meta',
        valor: money(capitalCents),
        nota: `${cotas} cotas de ${money(PRECO_DA_COTA_CENTS)}`,
        tom: 'atencao',
        metaCents: meta,
        capitalCents,
      }}
      respostaCerta={(r) => palpiteCertoDosFiis(r.metaCents, r.capitalCents)}
      explicacao={
        <p>
          Com cada cota pagando <b>{money(dividendoPorCotaCents)}</b> por mês, chegar em <b>{money(meta)}</b> pede{' '}
          <b>{cotas} cotas</b>. O rendimento é uma estimativa: ele muda de um mês pro outro.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Meta de renda mensal isenta"
          valor={meta}
          min={5_000}
          max={300_000}
          passo={5_000}
          onChange={setMeta}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Dividend Yield de ${pctDy(dy)} ao mês`}
      extras={
        <CampoRegua
          rotulo="Dividend Yield mensal estimado (cota R$ 100)"
          valor={dy}
          min={0.6}
          max={1.1}
          passo={0.05}
          onChange={setDy}
          formatar={pctDy}
        />
      }
      detalhes={
        <Quadros
          itens={[
            { rotulo: 'Cotas necessárias', valor: String(cotas), nota: `${money(dividendoPorCotaCents)}/cota` },
            { rotulo: 'Capital acumulado', valor: money(capitalCents), tom: 'bom', nota: 'para gerar a meta' },
          ]}
        />
      }
    />
  );
}
