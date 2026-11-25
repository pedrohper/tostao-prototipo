'use client';
// m5-l1: Aportes vs. aumento de renda, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

/** 0,8% ao mês. */
export const TAXA_MENSAL = 0.008;
/** A: do dia 1, por 10 anos. B: 3 anos cuidando da carreira (sem aportar) e 7 anos aportando. */
export const MESES_DESDE_O_COMECO = 120;
export const MESES_DEPOIS_DA_CARREIRA = 84;

export function montanteComAportes(aporteCents: number, meses: number) {
  let saldo = 0;
  for (let i = 0; i < meses; i++) {
    saldo = (saldo + aporteCents) * (1 + TAXA_MENSAL);
  }
  return Math.round(saldo);
}

export function compararAportes({ cedoCents, carreiraCents }: { cedoCents: number; carreiraCents: number }) {
  const totalCedoCents = montanteComAportes(cedoCents, MESES_DESDE_O_COMECO);
  const totalCarreiraCents = montanteComAportes(carreiraCents, MESES_DEPOIS_DA_CARREIRA);
  return { totalCedoCents, totalCarreiraCents, diferencaCents: totalCarreiraCents - totalCedoCents };
}

export type PalpiteDosAportes = 'cedo' | 'carreira' | 'dobro';

/** Quem termina na frente; a carreira só leva o "dobro" a partir de 2x o total de quem começou cedo. */
export function palpiteCertoDosAportes(totalCedoCents: number, totalCarreiraCents: number): PalpiteDosAportes {
  if (totalCarreiraCents < totalCedoCents) return 'cedo';
  return totalCarreiraCents < totalCedoCents * 2 ? 'carreira' : 'dobro';
}

function Barra({ parte, de, cor }: { parte: number; de: number; cor: string }) {
  return (
    <span className="mt-1 block h-2.5 w-full overflow-hidden rounded-full bg-cartao">
      <span style={{ width: `${Math.round((parte / de) * 100)}%` }} className={`block h-full ${cor}`} />
    </span>
  );
}

export function AportesVsAumentoDeRenda() {
  const [cedo, setCedo] = useState(5_000);
  const [carreira, setCarreira] = useState(80_000);

  const { totalCedoCents, totalCarreiraCents, diferencaCents } = compararAportes({
    cedoCents: cedo,
    carreiraCents: carreira,
  });
  const maior = Math.max(1, totalCedoCents, totalCarreiraCents);
  const carreiraNaFrente = diferencaCents >= 0;
  const diferenca = money(Math.abs(diferencaCents));

  return (
    <SimuladorShell
      pergunta="Daqui a 10 anos, quem junta mais?"
      cenario={[
        { rotulo: 'Guardando desde o dia 1, por 10 anos', valor: `${money(cedo)}/mês` },
        { rotulo: '3 anos de carreira primeiro, depois 7 guardando', valor: `${money(carreira)}/mês` },
        { rotulo: 'Rendimento nos dois', valor: '0,8% ao mês' },
      ]}
      palpites={[
        { id: 'cedo', rotulo: 'Quem guarda desde o dia 1' },
        { id: 'carreira', rotulo: 'A carreira primeiro, sem chegar ao dobro' },
        { id: 'dobro', rotulo: 'A carreira primeiro, com o dobro ou mais' },
      ]}
      resultado={{
        rotulo: carreiraNaFrente ? 'A carreira termina na frente por' : 'Guardar desde o dia 1 vence por',
        valor: diferenca,
        nota: `Carreira: ${money(totalCarreiraCents)} · dia 1: ${money(totalCedoCents)}`,
        tom: carreiraNaFrente ? 'bom' : 'atencao',
        totalCedoCents,
        totalCarreiraCents,
      }}
      respostaCerta={(r) => palpiteCertoDosAportes(r.totalCedoCents, r.totalCarreiraCents)}
      explicacao={
        <p>
          <Selo tipo="alta" />
          <b>Renda é o motor do aporte (0,8%/mês em 10 anos):</b> aumentar sua capacidade de ganhar gera{' '}
          <b>
            {diferenca} {carreiraNaFrente ? 'a mais' : 'a menos'}
          </b>{' '}
          do que depender só de aportes minúsculos desde o primeiro dia.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Cenário B: aporte após 3 anos de carreira (7 anos)"
          valor={carreira}
          min={30_000}
          max={200_000}
          passo={5_000}
          onChange={setCarreira}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`No cenário A, ${money(cedo)} por mês desde o dia 1`}
      extras={
        <CampoDinheiro
          rotulo="Cenário A: aporte desde o dia 1 (10 anos)"
          valor={cedo}
          min={5_000}
          max={40_000}
          passo={2_500}
          onChange={setCedo}
        />
      }
      detalhes={
        <>
          <Quadros
            titulo="Cenário A"
            itens={[
              {
                rotulo: `Só juros compostos (${money(cedo)}/mês)`,
                valor: money(totalCedoCents),
                tom: 'atencao',
                nota: <Barra parte={totalCedoCents} de={maior} cor="bg-amarelo" />,
              },
            ]}
          />
          <Quadros
            titulo="Cenário B"
            itens={[
              {
                rotulo: `Carreira + aporte maior (${money(carreira)}/mês)`,
                valor: money(totalCarreiraCents),
                tom: 'bom',
                nota: <Barra parte={totalCarreiraCents} de={maior} cor="bg-menta" />,
              },
            ]}
          />
        </>
      }
    />
  );
}
