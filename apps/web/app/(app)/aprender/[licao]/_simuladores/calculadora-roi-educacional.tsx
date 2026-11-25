'use client';
// m5-l2: Calculadora do ROI educacional, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type RoiEntrada = { custoCents: number; aumentoCents: number };

export function calcularRoiEducacional({ custoCents, aumentoCents }: RoiEntrada) {
  return {
    paybackMeses: custoCents / aumentoCents,
    retorno2AnosCents: aumentoCents * 24 - custoCents,
    roiPct: ((aumentoCents * 24 - custoCents) / custoCents) * 100,
  };
}

export type PalpiteDoRoi = 'ate-6' | 'ate-12' | 'mais';

export function palpiteCertoDoRoi(paybackMeses: number): PalpiteDoRoi {
  if (paybackMeses <= 6) return 'ate-6';
  return paybackMeses <= 12 ? 'ate-12' : 'mais';
}

export function CalculadoraRoiEducacional() {
  const [custo, setCusto] = useState(150_000);
  const [aumento, setAumento] = useState(50_000);

  const { paybackMeses, retorno2AnosCents, roiPct } = calcularRoiEducacional({
    custoCents: custo,
    aumentoCents: aumento,
  });
  const meses = `${paybackMeses.toFixed(1).replace('.', ',')} meses`;

  return (
    <SimuladorShell
      pergunta="Em quanto tempo esse curso se paga?"
      cenario={[
        { rotulo: 'Custo total do curso', valor: money(custo) },
        { rotulo: 'Aumento esperado na renda', valor: `+${money(aumento)}/mês` },
      ]}
      palpites={[
        { id: 'ate-6', rotulo: 'Em até 6 meses' },
        { id: 'ate-12', rotulo: 'Entre 6 meses e 1 ano' },
        { id: 'mais', rotulo: 'Só depois de 1 ano' },
      ]}
      resultado={{
        rotulo: 'Payback (se paga em)',
        valor: meses,
        nota: `Com +${money(aumento)} por mês`,
        tom: paybackMeses <= 12 ? 'bom' : retorno2AnosCents >= 0 ? 'atencao' : 'ruim',
        paybackMeses,
      }}
      respostaCerta={(r) => palpiteCertoDoRoi(r.paybackMeses)}
      explicacao={
        <p>
          <Selo tipo="dica" />
          <b>ROI em 24 meses: {roiPct.toFixed(0)}%.</b>{' '}
          {paybackMeses <= 12
            ? 'Excelente retorno: em menos de 1 ano o curso já devolveu cada centavo investido.'
            : 'Retorno de médio prazo: valide se a vaga/mercado realmente paga esse aumento antes de fechar.'}
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Custo total do curso / formação"
          valor={custo}
          min={20_000}
          max={1_000_000}
          passo={10_000}
          onChange={setCusto}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Contando +${money(aumento)} por mês na renda`}
      extras={
        <CampoDinheiro
          rotulo="Aumento mensal esperado na renda"
          valor={aumento}
          min={10_000}
          max={300_000}
          passo={5_000}
          onChange={setAumento}
        />
      }
      detalhes={
        <Quadros
          itens={[
            {
              rotulo: 'Lucro líquido em 2 anos',
              valor: money(retorno2AnosCents),
              tom: retorno2AnosCents >= 0 ? 'bom' : 'ruim',
            },
          ]}
        />
      }
    />
  );
}
