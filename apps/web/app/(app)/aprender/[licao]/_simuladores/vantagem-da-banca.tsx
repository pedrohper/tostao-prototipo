'use client';
// m9-l2: A vantagem da banca, no SimuladorShell (T6.15). A simulação é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type BancaEntrada = { bancaCents: number; apostaCents: number; seed: number };

/** Simulação determinística com RTP de 95% (casa fica com 5% em média). */
export function simularBanca({ bancaCents, apostaCents, seed }: BancaEntrada) {
  let saldo = bancaCents;
  let x = seed * 9301 + 49297;
  const pontos: number[] = [saldo];
  let jogadas = 0;

  for (let i = 1; i <= 1000; i++) {
    if (saldo < apostaCents) break;
    jogadas = i;
    x = (x * 16807) % 2147483647;
    const u = x / 2147483647;
    // Probabilidade de ganhar 2x: 47.5% -> RTP = 0.475 * 2 = 95%
    saldo += u < 0.475 ? apostaCents : -apostaCents;
    if (i % 200 === 0) pontos.push(saldo);
  }
  if (pontos.length < 6) pontos.push(saldo);
  return { saldoFinalCents: saldo, jogadas, pontos };
}

export type PalpiteDaBanca = 'ganha' | 'sobra' | 'zera';

export function palpiteCertoDaBanca(bancaCents: number, apostaCents: number, saldoFinalCents: number): PalpiteDaBanca {
  if (saldoFinalCents < apostaCents) return 'zera';
  return saldoFinalCents > bancaCents ? 'ganha' : 'sobra';
}

export function VantagemDaBanca() {
  const [banca, setBanca] = useState(10_000);
  const [aposta, setAposta] = useState(1_000);
  const [seed, setSeed] = useState(1);

  const { saldoFinalCents, jogadas, pontos } = simularBanca({ bancaCents: banca, apostaCents: aposta, seed });
  const maxPonto = Math.max(banca, ...pontos, 1);

  return (
    <SimuladorShell
      pergunta="Depois de até 1.000 jogadas, o que sobra da sua banca?"
      cenario={[
        { rotulo: 'Banca inicial', valor: money(banca) },
        { rotulo: 'Aposta por jogada', valor: money(aposta) },
        { rotulo: 'Chance de ganhar o valor apostado', valor: '47,5%' },
        { rotulo: 'Retorno teórico (RTP)', valor: '95%' },
        { rotulo: 'Rodada simulada', valor: `nº ${seed}` },
      ]}
      palpites={[
        { id: 'ganha', rotulo: `Mais que os ${money(banca)} do começo` },
        { id: 'sobra', rotulo: `Uma parte: até ${money(banca)}, ainda dando pra apostar` },
        { id: 'zera', rotulo: `Nem pra mais uma aposta de ${money(aposta)}` },
      ]}
      resultado={{
        rotulo: 'Saldo final',
        valor: money(saldoFinalCents),
        nota: jogadas < 1000 ? `Parou na jogada ${jogadas}: não dava pra apostar de novo` : 'Aguentou as 1.000 jogadas',
        tom: saldoFinalCents < banca ? 'ruim' : 'bom',
        saldoFinalCents,
      }}
      respostaCerta={(r) => palpiteCertoDaBanca(banca, aposta, r.saldoFinalCents)}
      explicacao={
        <p>
          <Selo tipo="dados" />
          Com retorno de <b>95%</b>, a casa fica em média com <b>5%</b> de cada aposta. Numa rodada ou outra você ganha;
          quanto mais joga, mais essa fatia pesa.
        </p>
      }
      principal={
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="min-h-[52px] w-full rounded-2xl bg-laranja px-4 py-3 text-[15px] font-extrabold text-tinta-fixa shadow-sm transition active:scale-[0.99]"
        >
          Simular 1.000 jogadas
        </button>
      }
      resumoExtras="A banca inicial e o valor de cada aposta"
      extras={
        <>
          <CampoDinheiro
            rotulo="Banca inicial"
            valor={banca}
            min={5_000}
            max={50_000}
            passo={5_000}
            onChange={setBanca}
          />
          <CampoDinheiro
            rotulo="Aposta por jogada (RTP 95%)"
            valor={aposta}
            min={200}
            max={2_000}
            passo={200}
            onChange={setAposta}
          />
        </>
      }
      detalhes={
        <div className="flex flex-col gap-3">
          <div
            role="img"
            aria-label="Gráfico do saldo ao longo das jogadas"
            className="flex h-24 items-end gap-1.5 rounded-2xl bg-papel-2 p-3"
          >
            {pontos.map((p, idx) => {
              const h = Math.max(6, Math.round((p / maxPonto) * 100));
              return (
                <div key={idx} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    style={{ height: `${h}%` }}
                    className={`w-full rounded-t-md ${p >= banca ? 'bg-menta' : 'bg-alerta'}`}
                  />
                </div>
              );
            })}
          </div>
          <Quadros itens={[{ rotulo: 'Jogadas até parar', valor: String(jogadas) }]} />
        </div>
      }
    />
  );
}
