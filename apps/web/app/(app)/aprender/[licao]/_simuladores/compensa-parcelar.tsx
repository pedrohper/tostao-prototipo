'use client';
// m2-l3: Compensa parcelar?, no SimuladorShell (T6.15). A conta é a mesma da página /compensa (`compararCompra`, em
// @tostao/contracts), com as taxas de referência da lição; os textos do veredito também são os de lá.
import { useState } from 'react';
import { TAXAS_REFERENCIA, compararCompra, pct, type VeredictoCompra } from '@tostao/contracts';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell, type TomDoResultado } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { getDictionary } from '@/lib/i18n';
import type { SimulatorProps } from './tipos';

export type CompraEntrada = { aVistaCents: number; parcelaCents: number; parcelas: number };

/** `parcelas` é um inteiro a partir de 1. */
export function avaliarCompra({ aVistaCents, parcelaCents, parcelas }: CompraEntrada): VeredictoCompra {
  return compararCompra({
    aVistaInCents: aVistaCents,
    parcelaInCents: parcelaCents,
    parcelas,
    rendeAnual: TAXAS_REFERENCIA.cdi,
  });
}

export type PalpiteDaCompra = VeredictoCompra['melhor'];

export const palpiteCertoDaCompra = (veredicto: Pick<VeredictoCompra, 'melhor'>): PalpiteDaCompra => veredicto.melhor;

const PALPITES: { id: PalpiteDaCompra; rotulo: string }[] = [
  { id: 'parcelado', rotulo: 'Parcelar compensa' },
  { id: 'a-vista', rotulo: 'Pagar à vista compensa' },
  { id: 'empate', rotulo: 'Dá quase na mesma' },
];

/** O cartão grande de cada veredito: a diferença em reais e o que ela significa. */
const CARTAO: Record<PalpiteDaCompra, { rotulo: string; nota: string; tom: TomDoResultado }> = {
  parcelado: { rotulo: 'Parcelar compensa', nota: 'é o que sobra no fim, parcelando', tom: 'bom' },
  'a-vista': { rotulo: 'À vista compensa', nota: 'é o que você perderia parcelando', tom: 'ruim' },
  empate: { rotulo: 'Dá praticamente na mesma', nota: 'de diferença entre os dois', tom: 'atencao' },
};

export function CompensaParcelar({ locale }: SimulatorProps) {
  const labels = getDictionary(locale).pages.calculators;
  const [aVista, setAVista] = useState(90_000);
  const [parcela, setParcela] = useState(10_000);
  const [parcelas, setParcelas] = useState(10);

  const v = avaliarCompra({ aVistaCents: aVista, parcelaCents: parcela, parcelas });
  const cdi = TAXAS_REFERENCIA.cdi;
  const diferenca = Math.abs(v.saldoParcelandoInCents);
  const parcelamento = `${parcelas}x de ${money(parcela)}`;

  return (
    <SimuladorShell
      pergunta="Parcelar ou pagar à vista: o que sai melhor?"
      cenario={[
        { rotulo: labels.cashPrice, valor: money(aVista) },
        { rotulo: 'Ou parcelado em', valor: parcelamento },
        { rotulo: 'Dinheiro guardado rende (CDI)', valor: `${pct(cdi)} ao ano` },
      ]}
      palpites={PALPITES}
      resultado={{ ...CARTAO[v.melhor], valor: money(diferenca), melhor: v.melhor }}
      respostaCerta={palpiteCertoDaCompra}
      explicacao={
        <p>
          {v.melhor === 'a-vista' && (
            <>
              <b>{labels.cashWinsBefore}</b>
              {labels.cashWinsBody(pct(v.taxaAno), pct(cdi), money(diferenca))}
            </>
          )}
          {v.melhor === 'parcelado' && (
            <>
              <b>{labels.installmentWinsBefore}</b>
              {labels.installmentWinsBody(money(v.saldoParcelandoInCents))}
            </>
          )}
          {v.melhor === 'empate' && (
            <>
              <b>{labels.tieBefore}</b>
              {labels.tieBody(money(diferenca))}
            </>
          )}
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo={labels.cashPrice}
          valor={aVista}
          min={1_000}
          max={2_000_000}
          passo={1_000}
          onChange={setAVista}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Parcelado em ${parcelamento}`}
      extras={
        <>
          <CampoRegua
            rotulo={labels.installmentsCount}
            valor={parcelas}
            min={1}
            max={48}
            passo={1}
            onChange={setParcelas}
            formatar={(n) => `${n}x`}
          />
          <CampoDinheiro
            rotulo={labels.eachInstallment}
            valor={parcela}
            min={500}
            max={500_000}
            passo={500}
            onChange={setParcela}
          />
        </>
      }
      detalhes={
        <Quadros
          itens={[
            { rotulo: labels.cashPrice, valor: money(aVista) },
            { rotulo: labels.totalParcelado, valor: money(v.totalParceladoInCents) },
            {
              rotulo: labels.hiddenInterest,
              valor: v.jurosInCents ? money(v.jurosInCents) : labels.noneWord,
              nota: v.jurosInCents > 0 ? labels.embeddedRate(pct(v.taxaMes, 2), pct(v.taxaAno)) : undefined,
              tom: v.jurosInCents > 0 ? 'ruim' : 'bom',
            },
          ]}
        />
      }
    />
  );
}
