'use client';
// m3-l4: Simulador de proposta do Desenrola/Serasa, no SimuladorShell (T6.15). A conta é a de sempre, agora em
// centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type AcordoEntrada = { rendaCents: number; parcelaCents: number };

export function avaliarAcordo({ rendaCents, parcelaCents }: AcordoEntrada) {
  const pct = (parcelaCents / rendaCents) * 100;
  const risco = pct > 20;
  /** O teto de 20% da renda, em centavos. */
  const limiteCents = Math.round((rendaCents * 20) / 100);
  return { pct, risco, limiteCents };
}

export type PalpiteDoAcordo = 'pesa' | 'cabe';

export const palpiteCertoDoAcordo = (risco: boolean): PalpiteDoAcordo => (risco ? 'pesa' : 'cabe');

export function SimuladorDesenrolaSerasa() {
  const [renda, setRenda] = useState(220_000);
  const [parcela, setParcela] = useState(55_000);

  const { pct, risco, limiteCents } = avaliarAcordo({ rendaCents: renda, parcelaCents: parcela });
  const pctTexto = `${pct.toFixed(1).replace('.', ',')}%`;

  return (
    <SimuladorShell
      pergunta="Essa parcela do acordo cabe no seu mês?"
      cenario={[
        { rotulo: 'Renda líquida mensal', valor: money(renda) },
        { rotulo: 'Parcela da renegociação', valor: money(parcela) },
      ]}
      palpites={[
        { id: 'pesa', rotulo: `Não: ${money(parcela)} por mês pesa demais` },
        { id: 'cabe', rotulo: `Sim: ${money(parcela)} por mês cabe` },
      ]}
      resultado={{
        rotulo: 'Comprometimento da renda',
        valor: pctTexto,
        nota: 'limite seguro: 20%',
        tom: risco ? 'ruim' : 'bom',
        risco,
      }}
      respostaCerta={(r) => palpiteCertoDoAcordo(r.risco)}
      explicacao={
        risco ? (
          <p>
            <Selo tipo="perigo" />
            <b>Zona de risco de re-inadimplência:</b> comprometer mais de 20% da renda com acordo ({money(limiteCents)}
            /mês no máximo) costuma quebrar o combinado no primeiro imprevisto. Peça prazo maior ou desconto maior antes
            de assinar.
          </p>
        ) : (
          <p>
            <Selo tipo="ok" />
            <b>Parcela saudável:</b> cabe dentro dos 20% recomendados da sua renda. Você consegue honrar o acordo sem
            atrasar aluguel, luz ou mercado.
          </p>
        )
      }
      principal={
        <CampoDinheiro
          rotulo="Parcela da renegociação"
          valor={parcela}
          min={5_000}
          max={200_000}
          passo={2_500}
          onChange={setParcela}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras="A sua renda líquida do mês"
      extras={
        <CampoDinheiro
          rotulo="Renda líquida mensal"
          valor={renda}
          min={120_000}
          max={800_000}
          passo={10_000}
          onChange={setRenda}
        />
      }
      detalhes={
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-[13px] leading-[18px] font-semibold">
            <span>Comprometimento da renda</span>
            <span className={`shrink-0 font-bold ${risco ? 'text-vermelho-texto' : 'text-verde-texto'}`}>
              {pctTexto}
            </span>
          </div>
          <div aria-hidden="true" className="h-3.5 w-full overflow-hidden rounded-full border border-linha bg-papel-2">
            <div
              style={{ width: `${Math.min(100, Math.round(pct))}%` }}
              className={`h-full transition-all duration-200 ${risco ? 'bg-laranja' : 'bg-menta'}`}
            />
          </div>
        </div>
      }
    />
  );
}
