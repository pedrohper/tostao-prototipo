'use client';
// m5-l5: Alocação inteligente da renda extra, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos
// desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type ExtraEntrada = { valorCents: number; pctPendencias: number; pctReserva: number };

export function alocarRendaExtra({ valorCents, pctPendencias, pctReserva }: ExtraEntrada) {
  const pendenciasCents = Math.round((valorCents * pctPendencias) / 100);
  // O teto só age em valor digitado com centavos quebrados: as duas metades arredondariam pra cima e o lazer ficaria
  // em −1 centavo.
  const reservaCents = Math.min(Math.round((valorCents * pctReserva) / 100), valorCents - pendenciasCents);
  return {
    pctLazer: Math.max(0, 100 - pctPendencias - pctReserva),
    pendenciasCents,
    reservaCents,
    lazerCents: valorCents - pendenciasCents - reservaCents,
  };
}

export type Fatias = { pctPendencias: number; pctReserva: number };

/** Mexer numa fatia nunca deixa a soma passar de 100%: a outra encolhe. */
export function mudarPendencias({ pctReserva }: Fatias, pctPendencias: number): Fatias {
  return { pctPendencias, pctReserva: pctPendencias + pctReserva > 100 ? 100 - pctPendencias : pctReserva };
}

export function mudarReserva({ pctPendencias }: Fatias, pctReserva: number): Fatias {
  return { pctReserva, pctPendencias: pctReserva + pctPendencias > 100 ? 100 - pctReserva : pctPendencias };
}

export const umQuarto = (valorCents: number) => Math.round(valorCents / 4);

export type PalpiteDoExtra = 'nada' | 'ate-um-quarto' | 'mais';

export function palpiteCertoDoExtra(lazerCents: number, valorCents: number): PalpiteDoExtra {
  if (lazerCents <= 0) return 'nada';
  return lazerCents <= umQuarto(valorCents) ? 'ate-um-quarto' : 'mais';
}

export function AlocacaoRendaExtra() {
  const [valor, setValor] = useState(60_000);
  const [fatias, setFatias] = useState<Fatias>({ pctPendencias: 40, pctReserva: 40 });
  const { pctPendencias, pctReserva } = fatias;

  const { pctLazer, pendenciasCents, reservaCents, lazerCents } = alocarRendaExtra({
    valorCents: valor,
    pctPendencias,
    pctReserva,
  });
  const quarto = money(umQuarto(valor));

  return (
    <SimuladorShell
      pergunta="Desse bico, quanto sobra pra curtir sem culpa?"
      cenario={[
        { rotulo: 'Valor do bico / freela', valor: money(valor) },
        { rotulo: 'Vai pra pendências e dívidas', valor: `${pctPendencias}%` },
        { rotulo: 'Vai pra reserva de emergência', valor: `${pctReserva}%` },
      ]}
      palpites={[
        { id: 'nada', rotulo: 'Nada: já tá tudo carimbado' },
        { id: 'ate-um-quarto', rotulo: `Alguma coisa, até ${quarto}` },
        { id: 'mais', rotulo: `Mais que ${quarto}` },
      ]}
      resultado={{
        rotulo: 'Sobra pro lazer',
        valor: money(lazerCents),
        nota: `${pctLazer}% do bico`,
        tom: lazerCents > 0 ? 'bom' : 'atencao',
        lazerCents,
      }}
      respostaCerta={(r) => palpiteCertoDoExtra(r.lazerCents, valor)}
      explicacao={
        <p>
          <Selo tipo="brilho" />
          <b>Regra do esforço recompensado:</b> separe uma fatia planejada para o lazer ({money(lazerCents)}) sem culpa
          — assim você mantém o gás para os próximos extras sem torrar tudo.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Valor do bico / freela"
          valor={valor}
          min={10_000}
          max={300_000}
          passo={5_000}
          onChange={setValor}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`${pctPendencias}% pras pendências e ${pctReserva}% pra reserva`}
      extras={
        <>
          <CampoRegua
            rotulo="Pendências / Dívidas"
            valor={pctPendencias}
            min={0}
            max={100}
            passo={5}
            onChange={(v) => setFatias(mudarPendencias(fatias, v))}
            formatar={(v) => `${v}%`}
          />
          <CampoRegua
            rotulo="Reserva de emergência"
            valor={pctReserva}
            min={0}
            max={100}
            passo={5}
            onChange={(v) => setFatias(mudarReserva(fatias, v))}
            formatar={(v) => `${v}%`}
          />
        </>
      }
      detalhes={
        <>
          <div className="flex h-4 w-full overflow-hidden rounded-full border border-linha bg-papel-2">
            <div style={{ width: `${pctPendencias}%` }} className="bg-amarelo transition-all" />
            <div style={{ width: `${pctReserva}%` }} className="bg-menta transition-all" />
            <div style={{ width: `${pctLazer}%` }} className="bg-rosa transition-all" />
          </div>
          <Quadros
            itens={[
              { rotulo: 'Pendências', valor: money(pendenciasCents), tom: 'atencao' },
              { rotulo: 'Reserva', valor: money(reservaCents), tom: 'bom' },
              { rotulo: `Lazer (${pctLazer}%)`, valor: money(lazerCents), tom: 'ruim' },
            ]}
          />
        </>
      }
    />
  );
}
