'use client';
// m6-l5: Equivalência CLT x PJ, no SimuladorShell (T6.15). Contas em centavos; tabelas em inss-irrf-clt.ts.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { calcInssCents, calcIrrfCents } from './inss-irrf-clt';

export type CltPjEntrada = { cltBrutoCents: number; beneficiosCents: number; pjMensalCents: number };

export function compararCltPj({ cltBrutoCents, beneficiosCents, pjMensalCents }: CltPjEntrada) {
  const inss = calcInssCents(cltBrutoCents);
  const irrf = calcIrrfCents(cltBrutoCents, inss);
  const cltLiqMensal = cltBrutoCents - inss - irrf;

  // CLT anual: 12 salários + 13º + 1/3 férias + FGTS (13,33 * 8%) + benefícios * 12
  const fgtsAnual = Math.round(cltBrutoCents * 0.08 * 13.33);
  const cltAnualCents =
    cltLiqMensal * 12 +
    cltLiqMensal + // 13º líquido aprox
    Math.round(cltLiqMensal / 3) + // 1/3 férias aprox
    fgtsAnual +
    beneficiosCents * 12;

  // PJ anual: 11 meses faturados (1 mês de descanso) - 6% DAS - R$ 200/mês contador
  const pjBrutoAnual = pjMensalCents * 11;
  const pjDas = Math.round(pjBrutoAnual * 0.06);
  const pjContador = 200 * 100 * 12;
  const pjAnualCents = Math.max(0, pjBrutoAnual - pjDas - pjContador);

  return { cltAnualCents, pjAnualCents, diffAnualCents: pjAnualCents - cltAnualCents };
}

export type PalpiteDoCltPj = 'clt' | 'pj';

/** Empate conta pro PJ, como a frase de sempre ("paga R$ 0,00 a mais"). */
export const palpiteCertoDoCltPj = (diffAnualCents: number): PalpiteDoCltPj => (diffAnualCents >= 0 ? 'pj' : 'clt');

export function EquivalenciaCltPj() {
  const [cltBruto, setCltBruto] = useState(500_000);
  const [beneficios, setBeneficios] = useState(80_000);
  const [pjMensal, setPjMensal] = useState(750_000);

  const { cltAnualCents, pjAnualCents, diffAnualCents } = compararCltPj({
    cltBrutoCents: cltBruto,
    beneficiosCents: beneficios,
    pjMensalCents: pjMensal,
  });
  const pjVence = palpiteCertoDoCltPj(diffAnualCents) === 'pj';

  return (
    <SimuladorShell
      pergunta="Essa proposta PJ paga mais que a CLT em um ano?"
      cenario={[
        { rotulo: 'CLT: salário bruto', valor: money(cltBruto) },
        { rotulo: 'CLT: benefícios por mês', valor: money(beneficios) },
        { rotulo: 'PJ: por mês (11 no ano)', valor: money(pjMensal) },
        { rotulo: 'PJ: DAS e contador', valor: '6% e R$ 200/mês' },
      ]}
      palpites={[
        { id: 'clt', rotulo: 'Não, a CLT vence' },
        { id: 'pj', rotulo: 'Sim, o PJ paga mais' },
      ]}
      resultado={{
        rotulo: pjVence ? 'O PJ paga a mais por ano' : 'A CLT vence por ano',
        valor: money(Math.abs(diffAnualCents)),
        nota: `CLT ~${money(Math.round(cltAnualCents / 12))}/mês · PJ ~${money(Math.round(pjAnualCents / 12))}/mês`,
        tom: pjVence ? 'bom' : 'atencao',
        diffAnualCents,
      }}
      respostaCerta={(r) => palpiteCertoDoCltPj(r.diffAnualCents)}
      explicacao={
        <p>
          <Selo tipo="dados" />
          {pjVence
            ? `O PJ paga ${money(diffAnualCents)} a mais por ano (considerando 11 meses trabalhados, 6% de DAS e R$ 200/mês de contador).`
            : `A CLT vence por ${money(Math.abs(diffAnualCents))}/ano quando somamos 13º, 1/3 de férias, FGTS e benefícios.`}
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Proposta PJ mensal"
          valor={pjMensal}
          min={200_000}
          max={2_500_000}
          passo={25_000}
          onChange={setPjMensal}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`CLT de ${money(cltBruto)} + ${money(beneficios)} de benefícios por mês`}
      extras={
        <>
          <CampoDinheiro
            rotulo="Salário bruto CLT"
            valor={cltBruto}
            min={200_000}
            max={1_500_000}
            passo={25_000}
            onChange={setCltBruto}
          />
          <CampoDinheiro
            rotulo="Benefícios CLT (VR/VA/Saúde por mês)"
            valor={beneficios}
            min={0}
            max={250_000}
            passo={10_000}
            onChange={setBeneficios}
          />
        </>
      }
      detalhes={
        <Quadros
          itens={[
            {
              rotulo: 'CLT líquido/ano',
              valor: money(cltAnualCents),
              nota: `~${money(Math.round(cltAnualCents / 12))}/mês, com 13º, 1/3 de férias, FGTS e benefícios`,
            },
            {
              rotulo: 'PJ líquido/ano',
              valor: money(pjAnualCents),
              tom: 'atencao',
              nota: `~${money(Math.round(pjAnualCents / 12))}/mês, com 11 meses, 6% de DAS e R$ 200/mês de contador`,
            },
          ]}
        />
      }
    />
  );
}
