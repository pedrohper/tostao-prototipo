'use client';
// m3-l5: Calculadora do Mínimo Existencial, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde
// a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

/** Decreto 11.567/2023 (R$ 600). */
export const PISO_LEGAL_CENTS = 60_000;

export type MinimoEntrada = {
  moradiaCents: number;
  alimentacaoCents: number;
  /** Água, luz e transporte. */
  basicosCents: number;
  rendaCents: number;
};

export function calcularMinimoExistencial(e: MinimoEntrada) {
  const minimoCents = e.moradiaCents + e.alimentacaoCents + e.basicosCents;
  const margemCents = e.rendaCents - minimoCents;
  /** O que dá pra negociar: nunca negativo. */
  const sobraCents = margemCents > 0 ? margemCents : 0;
  return { minimoCents, margemCents, sobraCents };
}

export type PalpiteDoMinimo = 'nada' | 'pouco' | 'mais';

/** O divisor entre "um pouco" e "mais": 20% da renda. */
export const tetoDoPouco = (rendaCents: number) => Math.round(rendaCents * 0.2);

export function palpiteCertoDoMinimo(rendaCents: number, margemCents: number): PalpiteDoMinimo {
  if (margemCents <= 0) return 'nada';
  return margemCents <= tetoDoPouco(rendaCents) ? 'pouco' : 'mais';
}

export function CalculadoraMinimoExistencial() {
  const [moradia, setMoradia] = useState(75_000);
  const [alimentacao, setAlimentacao] = useState(55_000);
  const [basicos, setBasicos] = useState(32_000);
  const [renda, setRenda] = useState(200_000);

  const { minimoCents, margemCents, sobraCents } = calcularMinimoExistencial({
    moradiaCents: moradia,
    alimentacaoCents: alimentacao,
    basicosCents: basicos,
    rendaCents: renda,
  });
  const teto = money(tetoDoPouco(renda));

  return (
    <SimuladorShell
      pergunta="Pagando o básico pra viver, quanto sobra pra negociar?"
      cenario={[
        { rotulo: 'Sua renda no mês', valor: money(renda) },
        { rotulo: 'Aluguel / Moradia', valor: money(moradia) },
        { rotulo: 'Alimentação básica', valor: money(alimentacao) },
        { rotulo: 'Água, luz e transporte', valor: money(basicos) },
      ]}
      palpites={[
        { id: 'nada', rotulo: 'Nada: o básico leva tudo' },
        { id: 'pouco', rotulo: `Alguma coisa, até ${teto}` },
        { id: 'mais', rotulo: `Mais que ${teto}` },
      ]}
      resultado={{
        rotulo: 'Sobra p/ negociar',
        valor: money(sobraCents),
        tom: margemCents > 0 ? 'bom' : 'ruim',
        margemCents,
      }}
      respostaCerta={(r) => palpiteCertoDoMinimo(renda, r.margemCents)}
      explicacao={
        <p>
          <Selo tipo="lei" />
          <b>Piso legal vs. vida real:</b> o decreto federal protege pelo menos <b>{money(PISO_LEGAL_CENTS)}</b> da
          renda na Lei do Superendividamento, mas o seu mínimo de sobrevivência real é <b>{money(minimoCents)}</b>. Só
          negocie parcelas que caibam na sobra real ({money(sobraCents)}).
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Sua renda mensal disponível"
          valor={renda}
          min={100_000}
          max={600_000}
          passo={10_000}
          onChange={setRenda}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras="Já descontei moradia, comida, água, luz e transporte"
      extras={
        <>
          <CampoDinheiro
            rotulo="Aluguel / Moradia"
            valor={moradia}
            min={0}
            max={250_000}
            passo={5_000}
            onChange={setMoradia}
          />
          <CampoDinheiro
            rotulo="Alimentação básica"
            valor={alimentacao}
            min={20_000}
            max={150_000}
            passo={5_000}
            onChange={setAlimentacao}
          />
          <CampoDinheiro
            rotulo="Água, luz e transporte"
            valor={basicos}
            min={10_000}
            max={100_000}
            passo={2_000}
            onChange={setBasicos}
          />
        </>
      }
      detalhes={<Quadros itens={[{ rotulo: 'Seu mínimo existencial', valor: money(minimoCents), tom: 'atencao' }]} />}
    />
  );
}
