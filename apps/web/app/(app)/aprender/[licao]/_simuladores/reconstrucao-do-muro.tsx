'use client';
// m4-l4: Reconstrução do muro, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type ReposicaoEntrada = { usouCents: number; porMesCents: number };

export function planejarReposicao({ usouCents, porMesCents }: ReposicaoEntrada) {
  const meses = Math.ceil(usouCents / porMesCents);
  const pctMes1 = Math.min(100, Math.round((porMesCents / usouCents) * 100));
  return { meses, pctMes1 };
}

export type PalpiteDaReposicao = 'ate3' | 'ate6' | 'mais';

export function palpiteCertoDaReposicao(meses: number): PalpiteDaReposicao {
  if (meses <= 3) return 'ate3';
  return meses <= 6 ? 'ate6' : 'mais';
}

const emMeses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;

export function ReconstrucaoDoMuro() {
  const [usou, setUsou] = useState(120_000);
  const [porMes, setPorMes] = useState(20_000);

  const { meses, pctMes1 } = planejarReposicao({ usouCents: usou, porMesCents: porMes });

  return (
    <SimuladorShell
      pergunta="Em quantos meses a sua reserva fica de pé de novo?"
      cenario={[
        { rotulo: 'Você usou da reserva', valor: money(usou) },
        { rotulo: 'Vai repor por mês', valor: money(porMes) },
      ]}
      palpites={[
        { id: 'ate3', rotulo: 'Em até 3 meses' },
        { id: 'ate6', rotulo: 'De 4 a 6 meses' },
        { id: 'mais', rotulo: 'Em mais de 6 meses' },
      ]}
      resultado={{
        rotulo: 'Tempo para reconstruir',
        valor: emMeses(meses),
        tom: 'bom',
        meses,
      }}
      respostaCerta={(r) => palpiteCertoDaReposicao(r.meses)}
      explicacao={
        <p>
          <Selo tipo="dica" />
          <b>Usar a reserva não é fracasso:</b> ela cumpriu o papel dela. Coloque a reposição de{' '}
          <b>{money(porMes)}/mês</b> como conta fixa até fechar <b>{meses === 1 ? 'esse mês' : `os ${meses} meses`}</b>.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Aporte mensal p/ recompor"
          valor={porMes}
          min={5_000}
          max={150_000}
          passo={5_000}
          onChange={setPorMes}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras="O quanto você usou da reserva"
      extras={
        <CampoDinheiro
          rotulo="Quanto usou da reserva"
          valor={usou}
          min={20_000}
          max={600_000}
          passo={10_000}
          onChange={setUsou}
        />
      }
      detalhes={
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-[13px] leading-[18px] font-semibold text-tinta-suave">
            <span>Progresso já no 1º mês</span>
            <span className="shrink-0">{pctMes1}% do muro de pé</span>
          </div>
          <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded-full border border-linha bg-papel-2">
            <div style={{ width: `${pctMes1}%` }} className="h-full bg-menta transition-all duration-200" />
          </div>
        </div>
      }
    />
  );
}
