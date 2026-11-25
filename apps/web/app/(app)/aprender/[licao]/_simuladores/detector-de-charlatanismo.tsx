'use client';
// m8-l4: O detector de charlatanismo, no SimuladorShell (T6.15). A conta é a de sempre, agora com o aporte em centavos
// desde a entrada. As projeções saem em reais: passam fácil do inteiro seguro em centavos.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { formatCompactMoney } from './formato-compacto';

export function projetarPromessa({ taxaMesPct, aporteCents }: { taxaMesPct: number; aporteCents: number }) {
  const aporte = aporteCents / 100;
  const r = taxaMesPct / 100;
  return {
    em5AnosReais: aporte * Math.pow(1 + r, 60),
    em10AnosReais: aporte * Math.pow(1 + r, 120),
    em20AnosReais: aporte * Math.pow(1 + r, 240),
  };
}

export type PalpiteDaPromessa = 'muito' | 'medio' | 'pouco';

/** Fronteiras dos palpites: 100 e 1.000 vezes o aporte. */
export const faixasDaPromessa = (aporteCents: number) => ({
  poucoCents: aporteCents * 100,
  muitoCents: aporteCents * 1000,
});

export function palpiteCertoDaPromessa(aporteCents: number, em20AnosReais: number): PalpiteDaPromessa {
  const { poucoCents, muitoCents } = faixasDaPromessa(aporteCents);
  if (em20AnosReais * 100 <= poucoCents) return 'pouco';
  return em20AnosReais * 100 <= muitoCents ? 'medio' : 'muito';
}

const pct = (v: number) => v.toFixed(1).replace('.', ',');

export function DetectorCharlatanismo() {
  const [taxaMes, setTaxaMes] = useState(5);
  const [aporte, setAporte] = useState(100_000);

  const { em5AnosReais, em10AnosReais, em20AnosReais } = projetarPromessa({
    taxaMesPct: taxaMes,
    aporteCents: aporte,
  });
  const { poucoCents, muitoCents } = faixasDaPromessa(aporte);

  return (
    <SimuladorShell
      pergunta="Se essa promessa fosse verdade, no que seu dinheiro viraria em 20 anos?"
      cenario={[
        { rotulo: 'Você coloca uma vez só', valor: money(aporte) },
        { rotulo: 'Prometem, por mês', valor: `${pct(taxaMes)}%` },
        { rotulo: 'Tempo', valor: '240 meses' },
      ]}
      palpites={[
        { id: 'pouco', rotulo: `Até ${money(poucoCents)}` },
        { id: 'medio', rotulo: `Entre ${money(poucoCents)} e ${money(muitoCents)}` },
        { id: 'muito', rotulo: `Mais de ${money(muitoCents)}` },
      ]}
      resultado={{
        rotulo: 'Em 20 anos, a promessa diz que vira',
        valor: formatCompactMoney(em20AnosReais),
        nota: `Sem colocar nada além dos ${money(aporte)}`,
        tom: 'ruim',
        aporteCents: aporte,
        em20AnosReais,
      }}
      respostaCerta={(r) => palpiteCertoDaPromessa(r.aporteCents, r.em20AnosReais)}
      explicacao={
        <p>
          <Selo tipo="perigo" />O PIB inteiro do Brasil é ~R$ 11 trilhões. Se alguém promete {pct(taxaMes)}% fixos ao
          mês, em poucos anos superaria toda a economia do país — é matematicamente impossível.
        </p>
      }
      principal={
        <CampoRegua
          rotulo="Rentabilidade mensal prometida"
          valor={taxaMes}
          min={2}
          max={15}
          passo={0.5}
          onChange={setTaxaMes}
          formatar={(v) => `${pct(v)}% ao mês`}
        />
      }
      resumoExtras={`Aporte único de ${money(aporte)}`}
      extras={
        <CampoDinheiro
          rotulo="Aporte inicial único"
          valor={aporte}
          min={50_000}
          max={1_000_000}
          passo={50_000}
          onChange={setAporte}
        />
      }
      detalhes={
        <Quadros
          titulo="A escalada"
          itens={[
            { rotulo: 'Em 5 anos (60 meses)', valor: formatCompactMoney(em5AnosReais), tom: 'atencao' },
            { rotulo: 'Em 10 anos (120 meses)', valor: formatCompactMoney(em10AnosReais), tom: 'ruim' },
            { rotulo: 'Em 20 anos (240 meses)', valor: formatCompactMoney(em20AnosReais), tom: 'ruim' },
          ]}
        />
      }
    />
  );
}
