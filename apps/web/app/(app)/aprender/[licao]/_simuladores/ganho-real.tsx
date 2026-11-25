'use client';
// m7-l5: Calculadora do ganho real, no SimuladorShell (T6.15). A conta é a de sempre, com a base em centavos.
import { useState } from 'react';
import { CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { Quadros } from '@/components/simulador-campos';
import { money } from '@/lib/format';

export const BASE_DO_GANHO_REAL_CENTS = 1_000_000;

export type GanhoRealEntrada = { nominalPct: number; ipcaPct: number; baseCents?: number };

export function calcularGanhoReal({ nominalPct, ipcaPct, baseCents = BASE_DO_GANHO_REAL_CENTS }: GanhoRealEntrada) {
  const realPct = ((1 + nominalPct / 100) / (1 + ipcaPct / 100) - 1) * 100;
  const em1AnoCents = Math.round(baseCents * (1 + realPct / 100));
  const em5AnosCents = Math.round(baseCents * Math.pow(1 + realPct / 100, 5));
  return { realPct, em1AnoCents, em5AnosCents };
}

export type PalpiteDoGanhoReal = 'tudo' | 'nada' | 'menos';

/** 'tudo' é a ilusão de olhar só o rendimento: com inflação acima de zero, o ganho real é sempre menor que ele. */
export function palpiteCertoDoGanhoReal(nominalPct: number, realPct: number): PalpiteDoGanhoReal {
  if (realPct <= 0) return 'nada';
  return realPct >= nominalPct ? 'tudo' : 'menos';
}

const pct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`;

export function CalculadoraGanhoReal() {
  const [nominal, setNominal] = useState(11.5);
  const [ipca, setIpca] = useState(4.5);

  const { realPct, em1AnoCents, em5AnosCents } = calcularGanhoReal({ nominalPct: nominal, ipcaPct: ipca });
  const valor = `${realPct >= 0 ? '+' : ''}${realPct.toFixed(2).replace('.', ',')}% ao ano`;

  return (
    <SimuladorShell
      pergunta="Descontando a inflação, quanto o seu dinheiro cresce de verdade?"
      cenario={[
        { rotulo: 'Seu dinheiro rende', valor: `${pct(nominal)} ao ano` },
        { rotulo: 'Inflação (IPCA)', valor: `${pct(ipca)} ao ano` },
      ]}
      palpites={[
        { id: 'tudo', rotulo: `Os ${pct(nominal)} inteiros` },
        { id: 'nada', rotulo: 'Nada: empata ou perde da inflação' },
        { id: 'menos', rotulo: `Cresce, mas menos que ${pct(nominal)}` },
      ]}
      resultado={{
        rotulo: 'Ganho real (Fórmula de Fisher)',
        valor,
        tom: realPct >= 0 ? 'bom' : 'ruim',
        nominalPct: nominal,
        realPct,
      }}
      respostaCerta={(r) => palpiteCertoDoGanhoReal(r.nominalPct, r.realPct)}
      explicacao={
        <p>
          Rendimento de <b>{pct(nominal)}</b> com inflação de <b>{pct(ipca)}</b>: não é só subtrair. A conta divide (1 +
          rendimento) por (1 + inflação), e a distância até 1 mostra quanto você passa a comprar a mais (ou a menos).
        </p>
      }
      principal={
        <CampoRegua
          rotulo="Rentabilidade nominal (% a.a.)"
          valor={nominal}
          min={4}
          max={20}
          passo={0.5}
          onChange={setNominal}
          formatar={pct}
        />
      }
      resumoExtras={`Inflação IPCA de ${pct(ipca)} ao ano`}
      extras={
        <CampoRegua
          rotulo="Inflação IPCA (% a.a.)"
          valor={ipca}
          min={2}
          max={15}
          passo={0.5}
          onChange={setIpca}
          formatar={pct}
        />
      }
      detalhes={
        <Quadros
          itens={[
            { rotulo: 'R$ 10 mil em 1 ano', valor: money(em1AnoCents), nota: 'em poder de compra' },
            { rotulo: 'R$ 10 mil em 5 anos', valor: money(em5AnosCents), nota: 'em poder de compra' },
          ]}
        />
      }
    />
  );
}
