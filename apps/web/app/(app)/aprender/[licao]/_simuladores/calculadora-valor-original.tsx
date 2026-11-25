'use client';
// m3-l3: Calculadora do valor original, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type CobrancaEntrada = { hojeCents: number; mesesAtraso: number; taxaEstimada: number };

export function calcularValorOriginal({ hojeCents, mesesAtraso, taxaEstimada }: CobrancaEntrada) {
  const principalCents = Math.round(hojeCents / Math.pow(1 + taxaEstimada / 100, mesesAtraso));
  const jurosCents = Math.max(0, hojeCents - principalCents);
  const ofertaMinCents = Math.round(principalCents * 0.8);
  const ofertaMaxCents = Math.min(hojeCents, Math.round(principalCents * 1.2));
  return { principalCents, jurosCents, ofertaMinCents, ofertaMaxCents };
}

export type PalpiteDoValorOriginal = 'pouco' | 'meio' | 'maior';

/** As faixas do palpite: 40% e 70% do que estão cobrando hoje. */
export const faixasDoValorOriginal = (hojeCents: number) => ({
  baixoCents: Math.round(hojeCents * 0.4),
  altoCents: Math.round(hojeCents * 0.7),
});

export function palpiteCertoDoValorOriginal(hojeCents: number, principalCents: number): PalpiteDoValorOriginal {
  const { baixoCents, altoCents } = faixasDoValorOriginal(hojeCents);
  if (principalCents < baixoCents) return 'pouco';
  return principalCents <= altoCents ? 'meio' : 'maior';
}

const taxaTexto = (v: number) => `${String(v).replace('.', ',')}%/mês`;

export function CalculadoraValorOriginal() {
  const [valorHoje, setValorHoje] = useState(450_000);
  const [mesesAtraso, setMesesAtraso] = useState(18);
  const [taxaEstimada, setTaxaEstimada] = useState(8);

  const { principalCents, jurosCents, ofertaMinCents, ofertaMaxCents } = calcularValorOriginal({
    hojeCents: valorHoje,
    mesesAtraso,
    taxaEstimada,
  });
  const faixas = faixasDoValorOriginal(valorHoje);

  return (
    <SimuladorShell
      pergunta="Quanto dessa cobrança era a dívida original?"
      cenario={[
        { rotulo: 'Valor cobrado hoje', valor: money(valorHoje) },
        { rotulo: 'Meses em atraso', valor: `${mesesAtraso}m` },
        { rotulo: 'Taxa estimada', valor: taxaTexto(taxaEstimada) },
      ]}
      palpites={[
        { id: 'pouco', rotulo: `Menos de ${money(faixas.baixoCents)}` },
        { id: 'meio', rotulo: `De ${money(faixas.baixoCents)} a ${money(faixas.altoCents)}` },
        { id: 'maior', rotulo: `Mais de ${money(faixas.altoCents)}` },
      ]}
      resultado={{
        rotulo: 'Principal original aprox.',
        valor: money(principalCents),
        nota: `de ${money(valorHoje)} que estão cobrando hoje`,
        tom: 'bom',
        principalCents,
      }}
      respostaCerta={(r) => palpiteCertoDoValorOriginal(valorHoje, r.principalCents)}
      explicacao={
        <p>
          <Selo tipo="ok" />
          <b>Faixa de contraoferta realista à vista:</b> entre <b>{money(ofertaMinCents)}</b> e{' '}
          <b>{money(ofertaMaxCents)}</b>. Nunca aceite a primeira proposta parcelada sem saber quanto da dívida é só
          bola de neve.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Valor cobrado hoje"
          valor={valorHoje}
          min={50_000}
          max={2_000_000}
          passo={25_000}
          onChange={setValorHoje}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`${mesesAtraso} ${mesesAtraso === 1 ? 'mês' : 'meses'} de atraso, taxa estimada de ${taxaTexto(taxaEstimada)}`}
      extras={
        <>
          <CampoRegua
            rotulo="Meses em atraso"
            valor={mesesAtraso}
            min={1}
            max={60}
            passo={1}
            onChange={setMesesAtraso}
            formatar={(v) => `${v}m`}
          />
          <CampoRegua
            rotulo="Taxa estimada"
            valor={taxaEstimada}
            min={2}
            max={15}
            passo={0.5}
            onChange={setTaxaEstimada}
            formatar={taxaTexto}
          />
        </>
      }
      detalhes={<Quadros itens={[{ rotulo: 'Só juros na cobrança', valor: money(jurosCents), tom: 'ruim' }]} />}
    />
  );
}
