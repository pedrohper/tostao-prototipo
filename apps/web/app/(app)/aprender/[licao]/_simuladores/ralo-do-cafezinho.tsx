'use client';
// m1-l1: O ralo do cafezinho, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { PresetHint } from '@/components/preset-hint';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { raloPreset } from '@/lib/lesson-context';
import type { SimulatorProps } from './tipos';

/** Base da comparação quando a renda da pessoa não é conhecida. */
export const SALARIO_DE_EXEMPLO_CENTS = 130_790;

export type RaloEntrada = { gastinhoCents: number; vezesPorSemana: number; salarioCents: number };

export function calcularRalo({ gastinhoCents, vezesPorSemana, salarioCents }: RaloEntrada) {
  const porSemanaCents = gastinhoCents * vezesPorSemana;
  const tresMesesCents = Math.round(porSemanaCents * 13);
  const anoCents = Math.round(porSemanaCents * 52);
  return { porSemanaCents, tresMesesCents, anoCents, salarios: anoCents / salarioCents };
}

export type PalpiteDoRalo = 'menos-de-um' | 'um-a-tres' | 'mais-de-tres';

/** O ano de gastinhos comparado ao salário: menos de 1, de 1 a 3 (inclusive), ou mais de 3. */
export function palpiteCertoDoRalo(anoCents: number, salarioCents: number): PalpiteDoRalo {
  if (anoCents < salarioCents) return 'menos-de-um';
  return anoCents <= salarioCents * 3 ? 'um-a-tres' : 'mais-de-tres';
}

export function RaloDoCafezinho({ userContext = null }: SimulatorProps) {
  const preset = raloPreset(userContext);
  const [gastinho, setGastinho] = useState(preset.valor * 100);
  const [vezes, setVezes] = useState(preset.vezes);
  const salario = preset.salarioCents ?? SALARIO_DE_EXEMPLO_CENTS;
  const { porSemanaCents, tresMesesCents, anoCents, salarios } = calcularRalo({
    gastinhoCents: gastinho,
    vezesPorSemana: vezes,
    salarioCents: salario,
  });

  return (
    <SimuladorShell
      pergunta="Quanto esse gastinho leva de você em 1 ano?"
      aviso={preset.hint && <PresetHint>{preset.hint}</PresetHint>}
      cenario={[
        { rotulo: 'Cada gastinho', valor: money(gastinho) },
        { rotulo: 'Vezes por semana', valor: `${vezes}x` },
        { rotulo: preset.salarioCents ? 'Sua renda no mês' : 'Salário de exemplo', valor: money(salario) },
      ]}
      palpites={[
        { id: 'menos-de-um', rotulo: `Menos que 1 salário (${money(salario)})` },
        { id: 'um-a-tres', rotulo: 'De 1 a 3 salários' },
        { id: 'mais-de-tres', rotulo: `Mais que 3 salários (${money(salario * 3)})` },
      ]}
      resultado={{
        rotulo: 'Em 1 ano, isso soma',
        valor: money(anoCents),
        nota: `${money(porSemanaCents)} por semana`,
        tom: palpiteCertoDoRalo(anoCents, salario) === 'mais-de-tres' ? 'ruim' : 'atencao',
        anoCents,
      }}
      respostaCerta={(r) => palpiteCertoDoRalo(r.anoCents, salario)}
      explicacao={
        <p>
          Isso dá <b>{salarios.toFixed(1).replace('.', ',')} salários</b> de {money(salario)} por ano.
        </p>
      }
      principal={
        <CampoRegua
          rotulo="Vezes por semana"
          valor={vezes}
          min={1}
          max={7}
          passo={1}
          onChange={setVezes}
          formatar={(v) => `${v}x`}
        />
      }
      resumoExtras={`Cada gastinho de ${money(gastinho)}`}
      extras={
        <CampoDinheiro
          rotulo="Cada gastinho"
          valor={gastinho}
          min={1_000}
          max={3_000}
          passo={100}
          onChange={setGastinho}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      detalhes={<Quadros itens={[{ rotulo: 'Em 3 meses', valor: money(tresMesesCents), tom: 'atencao' }]} />}
    />
  );
}
