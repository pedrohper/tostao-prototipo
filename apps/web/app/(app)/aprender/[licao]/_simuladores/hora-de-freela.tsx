'use client';
// m5-l4: Calculadora da hora de freela, no SimuladorShell (T6.13). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type FreelaEntrada = { horas: number; valorHoraCents: number; custosCents: number; margemPct: number };

export function calcularHoraDeFreela(e: FreelaEntrada) {
  const maoDeObraCents = e.horas * e.valorHoraCents;
  const margemCents = Math.round((maoDeObraCents * e.margemPct) / 100);
  const precoMinimoCents = maoDeObraCents + margemCents + e.custosCents;
  return { maoDeObraCents, margemCents, precoMinimoCents };
}

export type PalpiteDoFreela = 'so-horas' | 'um-pouco' | 'bem-mais';

/** Teto do "um pouco mais": as horas + 20%. */
export const tetoDoUmPouco = (maoDeObraCents: number) => Math.round(maoDeObraCents * 1.2);

export function palpiteCertoDoFreela(maoDeObraCents: number, precoMinimoCents: number): PalpiteDoFreela {
  if (precoMinimoCents <= maoDeObraCents) return 'so-horas';
  return precoMinimoCents <= tetoDoUmPouco(maoDeObraCents) ? 'um-pouco' : 'bem-mais';
}

export function CalculadoraHoraDeFreela() {
  const [horas, setHoras] = useState(12);
  const [valorHora, setValorHora] = useState(6_000);
  const [custos, setCustos] = useState(12_000);
  const [margem, setMargem] = useState(20);

  const { maoDeObraCents, margemCents, precoMinimoCents } = calcularHoraDeFreela({
    horas,
    valorHoraCents: valorHora,
    custosCents: custos,
    margemPct: margem,
  });
  const aMaisCents = precoMinimoCents - maoDeObraCents;
  const teto = money(tetoDoUmPouco(maoDeObraCents));

  return (
    <SimuladorShell
      pergunta="Quanto cobrar nesse freela sem pagar pra trabalhar?"
      cenario={[
        { rotulo: 'Horas de trabalho', valor: `${horas}h` },
        { rotulo: 'Quanto vale a sua hora', valor: money(valorHora) },
        { rotulo: 'Custos (net, MEI, apps)', valor: money(custos) },
        { rotulo: 'Folga pra revisões', valor: `+${margem}%` },
      ]}
      palpites={[
        { id: 'so-horas', rotulo: `Só as horas: ${money(maoDeObraCents)}` },
        { id: 'um-pouco', rotulo: `Um pouco mais, até ${teto}` },
        { id: 'bem-mais', rotulo: `Bem mais que ${teto}` },
      ]}
      resultado={{
        rotulo: 'Preço mínimo a cobrar',
        valor: money(precoMinimoCents),
        nota: aMaisCents > 0 ? `${money(aMaisCents)} a mais que só as horas` : 'Sem custo nem folga: só as horas',
        tom: 'bom',
        maoDeObraCents,
        precoMinimoCents,
      }}
      respostaCerta={(r) => palpiteCertoDoFreela(r.maoDeObraCents, r.precoMinimoCents)}
      explicacao={
        <p>
          <Selo tipo="dados" />
          <b>Sem pagar para trabalhar:</b> {money(maoDeObraCents)} de horas + {money(margemCents)} de margem de
          alteração + {money(custos)} de custos diretos.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Quanto vale a sua hora"
          valor={valorHora}
          min={2_000}
          max={20_000}
          passo={500}
          onChange={setValorHora}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`${horas}h de trabalho, ${money(custos)} de custos e +${margem}% de folga`}
      extras={
        <>
          <CampoRegua
            rotulo="Horas de trabalho"
            valor={horas}
            min={2}
            max={60}
            passo={1}
            onChange={setHoras}
            formatar={(v) => `${v}h`}
          />
          <CampoDinheiro
            rotulo="Custos (net, MEI, apps)"
            valor={custos}
            min={0}
            max={80_000}
            passo={2_000}
            onChange={setCustos}
          />
          <CampoRegua
            rotulo="Folga pra revisões"
            valor={margem}
            min={0}
            max={40}
            passo={5}
            onChange={setMargem}
            formatar={(v) => `+${v}%`}
          />
        </>
      }
    />
  );
}
