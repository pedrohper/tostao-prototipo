'use client';
// m6-l1: Calculadora do holerite real, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { valorQueCabe } from './apoio-m6-m8';
import { calcInssCents, calcIrrfCents } from './inss-irrf-clt';

export function calcularHolerite({ brutoCents }: { brutoCents: number }) {
  const inssCents = calcInssCents(brutoCents);
  const irrfCents = calcIrrfCents(brutoCents, inssCents);
  const liquidoCents = brutoCents - inssCents - irrfCents;
  const descontoPct = ((inssCents + irrfCents) / brutoCents) * 100;
  return { inssCents, irrfCents, liquidoCents, descontoPct };
}

export type PalpiteDoHolerite = 'mais' | 'meio' | 'menos';

/** As fronteiras dos palpites: 90% e 80% do bruto. */
export const faixasDoHolerite = (brutoCents: number) => ({
  altoCents: Math.round(brutoCents * 0.9),
  baixoCents: Math.round(brutoCents * 0.8),
});

export function palpiteCertoDoHolerite(brutoCents: number, liquidoCents: number): PalpiteDoHolerite {
  const { altoCents, baixoCents } = faixasDoHolerite(brutoCents);
  if (liquidoCents > altoCents) return 'mais';
  return liquidoCents >= baixoCents ? 'meio' : 'menos';
}

export function CalculadoraHoleriteReal() {
  const [bruto, setBruto] = useState(350_000);

  const { inssCents, irrfCents, liquidoCents, descontoPct } = calcularHolerite({ brutoCents: bruto });
  const { altoCents, baixoCents } = faixasDoHolerite(bruto);

  return (
    <SimuladorShell
      pergunta="Quanto desse salário cai de verdade na sua conta?"
      cenario={[
        { rotulo: 'Salário bruto CLT', valor: money(bruto) },
        { rotulo: 'Sai antes de cair', valor: 'INSS e IRRF' },
      ]}
      palpites={[
        { id: 'mais', rotulo: `Mais de ${money(altoCents)}` },
        { id: 'meio', rotulo: `De ${money(baixoCents)} a ${money(altoCents)}` },
        { id: 'menos', rotulo: `Menos de ${money(baixoCents)}` },
      ]}
      resultado={{
        rotulo: 'Líquido real que cai na conta',
        valor: valorQueCabe(money(liquidoCents), 'na conta'),
        nota: `−${descontoPct.toFixed(1).replace('.', ',')}% de descontos`,
        tom: 'bom',
        brutoCents: bruto,
        liquidoCents,
      }}
      respostaCerta={(r) => palpiteCertoDoHolerite(r.brutoCents, r.liquidoCents)}
      explicacao={
        <p>
          <Selo tipo="dica" />O INSS é cobrado por faixas (como uma escada), não sobre o total. E o IRRF usa o desconto
          simplificado automático quando ele é mais vantajoso que a dedução do INSS.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Salário bruto CLT"
          valor={bruto}
          min={150_000}
          max={1_500_000}
          passo={10_000}
          onChange={setBruto}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      detalhes={
        <Quadros
          titulo="Do bruto pro líquido"
          itens={[
            { rotulo: 'Salário bruto', valor: money(bruto) },
            { rotulo: 'INSS progressivo', valor: `−${money(inssCents)}`, tom: 'ruim' },
            { rotulo: 'IRRF na fonte', valor: `−${money(irrfCents)}`, tom: 'ruim' },
          ]}
        />
      }
    />
  );
}
