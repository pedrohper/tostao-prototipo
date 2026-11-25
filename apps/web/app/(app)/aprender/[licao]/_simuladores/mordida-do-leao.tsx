'use client';
// m7-l3: A mordida do Leão no resgate, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell, type TomDoResultado } from '@/components/simulador-shell';
import { money } from '@/lib/format';

const TAXA_ANUAL = 0.1115;

const CENARIOS: readonly { label: string; dias: number; iof: number; ir: number; tom: TomDoResultado }[] = [
  { label: 'Dia 15', dias: 15, iof: 0.5, ir: 0.225, tom: 'ruim' },
  { label: 'Dia 181', dias: 181, iof: 0, ir: 0.2, tom: 'atencao' },
  { label: 'Dia 721', dias: 721, iof: 0, ir: 0.15, tom: 'bom' },
];

export function calcularMordidaDoLeao({ valorCents }: { valorCents: number }) {
  const valor = valorCents / 100;
  return CENARIOS.map((c) => {
    const bruto = valor * Math.pow(1 + TAXA_ANUAL, c.dias / 365);
    const lucroBruto = bruto - valor;
    const descIof = lucroBruto * c.iof;
    const descIr = (lucroBruto - descIof) * c.ir;
    const impostoCents = Math.round((descIof + descIr) * 100);
    const lucroLiqCents = Math.round((lucroBruto - descIof - descIr) * 100);
    // Soma dos dois já arredondados: o que aparece na tela sempre fecha (imposto + sobra = lucro).
    return { ...c, impostoCents, lucroLiqCents, lucroBrutoCents: impostoCents + lucroLiqCents };
  });
}

export type PalpiteDoLeao = 'pouco' | 'metade' | 'tudo';

/** Fronteiras dos palpites: 35% e 90% do lucro. */
export const faixasDoLeao = (lucroBrutoCents: number) => ({
  poucoCents: Math.round(lucroBrutoCents * 0.35),
  quaseTudoCents: Math.round(lucroBrutoCents * 0.9),
});

export function palpiteCertoDoLeao(lucroBrutoCents: number, impostoCents: number): PalpiteDoLeao {
  const { poucoCents, quaseTudoCents } = faixasDoLeao(lucroBrutoCents);
  if (impostoCents <= poucoCents) return 'pouco';
  return impostoCents < quaseTudoCents ? 'metade' : 'tudo';
}

const pct = (v: number, casas: number) => `${(v * 100).toFixed(casas).replace('.', ',')}%`;

export function MordidaLeaoResgate() {
  const [valor, setValor] = useState(100_000);

  const cenarios = calcularMordidaDoLeao({ valorCents: valor });
  const dia15 = cenarios[0]!;
  const { poucoCents, quaseTudoCents } = faixasDoLeao(dia15.lucroBrutoCents);

  return (
    <SimuladorShell
      pergunta="Resgatando no dia 15, quanto do lucro o Leão leva?"
      cenario={[
        { rotulo: 'CDB 100% do CDI', valor: money(valor) },
        { rotulo: 'Lucro antes dos impostos', valor: money(dia15.lucroBrutoCents) },
        { rotulo: 'No dia 15 incidem', valor: 'IOF e IR' },
      ]}
      palpites={[
        { id: 'pouco', rotulo: `Uma beliscada: até ${money(poucoCents)}` },
        { id: 'metade', rotulo: `Mordida grande: entre ${money(poucoCents)} e ${money(quaseTudoCents)}` },
        { id: 'tudo', rotulo: `Quase tudo: ${money(quaseTudoCents)} ou mais` },
      ]}
      resultado={{
        rotulo: 'No dia 15, o Leão leva',
        valor: money(dia15.impostoCents),
        nota: `Sobram ${money(dia15.lucroLiqCents)} de lucro pra você`,
        tom: 'ruim',
        lucroBrutoCents: dia15.lucroBrutoCents,
        impostoCents: dia15.impostoCents,
      }}
      respostaCerta={(r) => palpiteCertoDoLeao(r.lucroBrutoCents, r.impostoCents)}
      explicacao={
        <p>
          De <b>{money(dia15.lucroBrutoCents)}</b> de lucro no dia 15, <b>{money(dia15.impostoCents)}</b> vão em IOF e
          IR. Com o tempo o IOF zera e o IR cai. O imposto pega só o rendimento, nunca o que você depositou.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Aplicação inicial (CDB 100% CDI)"
          valor={valor}
          min={100_000}
          max={2_000_000}
          passo={50_000}
          onChange={setValor}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      detalhes={
        <Quadros
          titulo="Lucro líquido por dia de resgate"
          itens={cenarios.map((c) => ({
            rotulo: `${c.label} · IOF ${pct(c.iof, 0)} · IR ${pct(c.ir, 1)}`,
            valor: `+${money(c.lucroLiqCents)}`,
            tom: c.tom,
            nota: `Leão levou ${money(c.impostoCents)}`,
          }))}
        />
      }
    />
  );
}
