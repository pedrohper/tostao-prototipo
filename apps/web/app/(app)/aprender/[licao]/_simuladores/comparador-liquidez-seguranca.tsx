'use client';
// m4-l2: Comparador de liquidez e segurança, no SimuladorShell (T6.15). A conta é a de sempre, agora recebendo a
// urgência já em centavos.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export function compararLiquidez(urgenciaCents: number) {
  // Investimento travado D+30 força 1 mês no rotativo (~15% com IOF) enquanto rende ~1% travado
  const custoRotativoCents = Math.round(urgenciaCents * 0.15);
  const rendimentoTravadoCents = Math.round(urgenciaCents * 0.01);
  const prejuizoTravadoCents = custoRotativoCents - rendimentoTravadoCents;
  return { custoRotativoCents, rendimentoTravadoCents, prejuizoTravadoCents };
}

export type PalpiteDaLiquidez = 'muito' | 'pouco' | 'nada';

/** O divisor do palpite: 10% do valor da urgência. */
export const corteDaLiquidez = (urgenciaCents: number) => Math.round(urgenciaCents * 0.1);

export function palpiteCertoDaLiquidez(urgenciaCents: number, prejuizoCents: number): PalpiteDaLiquidez {
  if (prejuizoCents <= 0) return 'nada';
  return prejuizoCents <= corteDaLiquidez(urgenciaCents) ? 'pouco' : 'muito';
}

export function ComparadorLiquidezSeguranca() {
  const [urgencia, setUrgencia] = useState(120_000);

  const { custoRotativoCents, rendimentoTravadoCents, prejuizoTravadoCents } = compararLiquidez(urgencia);
  const corte = money(corteDaLiquidez(urgencia));

  return (
    <SimuladorShell
      pergunta="Com o dinheiro travado, quanto essa urgência te custa a mais?"
      cenario={[
        { rotulo: 'Urgência médica hoje', valor: money(urgencia) },
        { rotulo: 'Seu dinheiro só sai em', valor: '30 dias' },
        { rotulo: 'Até lá, rotativo com IOF', valor: '~15%' },
        { rotulo: 'O travado rende no mês', valor: '~1%' },
      ]}
      palpites={[
        { id: 'muito', rotulo: `Mais de ${corte}` },
        { id: 'pouco', rotulo: `Alguma coisa, até ${corte}` },
        { id: 'nada', rotulo: 'Nada: o rendimento cobre o juro' },
      ]}
      resultado={{
        rotulo: 'Prejuízo líquido com o dinheiro travado',
        valor: `−${money(prejuizoTravadoCents)}`,
        nota: 'na reserva D+0 seriam R$ 0,00 de juros',
        tom: 'ruim',
        prejuizoTravadoCents,
      }}
      respostaCerta={(r) => palpiteCertoDaLiquidez(urgencia, r.prejuizoTravadoCents)}
      explicacao={
        <p>
          <Selo tipo="dica" />
          <b>Liquidez vale mais que 0,1% de rentabilidade:</b> mesmo que o investimento travado renda{' '}
          {money(rendimentoTravadoCents)} no mês, o rotativo cobra <b>{money(custoRotativoCents)}</b> até o dinheiro
          destravar. Reserva de emergência precisa ser D+0.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Urgência médica inesperada"
          valor={urgencia}
          min={30_000}
          max={500_000}
          passo={10_000}
          onChange={setUrgencia}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      detalhes={
        <Quadros
          titulo="Os dois caminhos"
          itens={[
            { rotulo: 'Reserva D+0', valor: 'R$ 0,00', nota: 'CDB 100% CDI / Selic · de juros pagos', tom: 'bom' },
            {
              rotulo: 'Travado D+30',
              valor: `−${money(prejuizoTravadoCents)}`,
              nota: 'Cai no rotativo 30d · prejuízo líquido',
              tom: 'ruim',
            },
            { rotulo: 'O travado rende no mês', valor: money(rendimentoTravadoCents) },
          ]}
        />
      }
    />
  );
}
