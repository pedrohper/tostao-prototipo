'use client';
// m7-l1: Calculadora do CDI, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export function calcularCdi({ valorCents, meses }: { valorCents: number; meses: number }) {
  const valor = valorCents / 100;
  const dias = meses * 30;
  const irAliquota = dias <= 180 ? 0.225 : dias <= 360 ? 0.2 : dias <= 720 ? 0.175 : 0.15;

  const taxaCdiAnual = 0.1115;
  const taxaPoupancaAnual = 0.0717; // 6,17% + TR ~1%

  const brutoCdb = valor * Math.pow(1 + taxaCdiAnual, meses / 12);
  const lucroBrutoCdb = brutoCdb - valor;
  const liqCdbCents = Math.round((valor + lucroBrutoCdb * (1 - irAliquota)) * 100);

  const liqPoupancaCents = Math.round(valor * Math.pow(1 + taxaPoupancaAnual, meses / 12) * 100);
  const diferencaCents = liqCdbCents - liqPoupancaCents;
  return { irAliquota, liqCdbCents, liqPoupancaCents, diferencaCents };
}

export type PalpiteDoCdi = 'poupanca' | 'pouco' | 'mais';

/** Fronteira entre "por pouco" e "por mais": 1% do valor aplicado. */
export const umPorCentoDoCdi = (valorCents: number) => Math.round(valorCents / 100);

export function palpiteCertoDoCdi(valorCents: number, diferencaCents: number): PalpiteDoCdi {
  if (diferencaCents <= 0) return 'poupanca';
  return diferencaCents < umPorCentoDoCdi(valorCents) ? 'pouco' : 'mais';
}

const pctIr = (aliquota: number) => `${(aliquota * 100).toFixed(1).replace('.', ',')}%`;

export function CalculadoraCDI() {
  const [valor, setValor] = useState(100_000);
  const [meses, setMeses] = useState(12);

  const { irAliquota, liqCdbCents, liqPoupancaCents, diferencaCents } = calcularCdi({ valorCents: valor, meses });
  const corte = money(umPorCentoDoCdi(valor));

  return (
    <SimuladorShell
      pergunta="CDB pagando imposto ou poupança isenta: quem rende mais?"
      cenario={[
        { rotulo: 'Valor aplicado', valor: money(valor) },
        { rotulo: 'Prazo', valor: `${meses} meses` },
        { rotulo: 'CDB 100% do CDI', valor: '~11,15% a.a.' },
        { rotulo: 'IR do CDB nesse prazo', valor: pctIr(irAliquota) },
        { rotulo: 'Poupança (isenta)', valor: '~6,17% + TR' },
      ]}
      palpites={[
        { id: 'poupanca', rotulo: 'A poupança, que não paga IR' },
        { id: 'pouco', rotulo: `O CDB, por menos de ${corte}` },
        { id: 'mais', rotulo: `O CDB, por ${corte} ou mais` },
      ]}
      resultado={{
        rotulo: diferencaCents >= 0 ? 'O CDB deixa a mais no seu bolso' : 'A poupança deixa a mais no seu bolso',
        valor: money(Math.abs(diferencaCents)),
        nota: `Em ${meses} meses, já descontado o IR`,
        tom: diferencaCents >= 0 ? 'bom' : 'ruim',
        valorCents: valor,
        diferencaCents,
      }}
      respostaCerta={(r) => palpiteCertoDoCdi(r.valorCents, r.diferencaCents)}
      explicacao={
        <p>
          <Selo tipo="alta" />
          Mesmo pagando Imposto de Renda, o CDB 100% CDI coloca <b>{money(diferencaCents)}</b> a mais no seu bolso nesse
          prazo.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Valor aplicado"
          valor={valor}
          min={50_000}
          max={2_000_000}
          passo={50_000}
          onChange={setValor}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Prazo de ${meses} meses (IR ${pctIr(irAliquota)})`}
      extras={
        <CampoRegua
          rotulo="Prazo"
          valor={meses}
          min={3}
          max={60}
          passo={3}
          onChange={setMeses}
          formatar={(v) => `${v} meses`}
        />
      }
      detalhes={
        <Quadros
          itens={[
            {
              rotulo: 'CDB 100% CDI (líquido)',
              valor: money(liqCdbCents),
              tom: 'bom',
              nota: '~11,15% a.a. − IR',
            },
            { rotulo: 'Poupança (isenta)', valor: money(liqPoupancaCents), nota: '~6,17% + TR' },
          ]}
        />
      }
    />
  );
}
