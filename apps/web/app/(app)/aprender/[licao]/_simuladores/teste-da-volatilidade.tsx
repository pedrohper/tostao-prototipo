'use client';
// m8-l5: O teste cardíaco da volatilidade, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export function simularVolatilidade({ valorCents, quedaPct }: { valorCents: number; quedaPct: number }) {
  const aposQuedaCents = Math.round(valorCents * (1 - quedaPct / 100));
  const rendaFixaCents = Math.round(valorCents * 1.01);
  const altaNecessariaPct = (1 / (1 - quedaPct / 100) - 1) * 100;
  return { aposQuedaCents, rendaFixaCents, altaNecessariaPct };
}

export type PalpiteDaVolatilidade = 'bem-mais' | 'mesma' | 'pouco-mais';

/** Fronteira entre "um pouco mais" e "bem mais": a queda + 10 pontos. */
export function palpiteCertoDaVolatilidade(quedaPct: number, altaNecessariaPct: number): PalpiteDaVolatilidade {
  if (altaNecessariaPct <= quedaPct) return 'mesma';
  return altaNecessariaPct <= quedaPct + 10 ? 'pouco-mais' : 'bem-mais';
}

export function TesteCardiacoVolatilidade() {
  const [valor, setValor] = useState(100_000);
  const [queda, setQueda] = useState(35);

  const { aposQuedaCents, rendaFixaCents, altaNecessariaPct } = simularVolatilidade({
    valorCents: valor,
    quedaPct: queda,
  });
  const alta = `+${altaNecessariaPct.toFixed(1).replace('.', ',')}%`;

  return (
    <SimuladorShell
      pergunta="Depois do tombo, quanto precisa subir só pra empatar?"
      cenario={[
        { rotulo: 'Valor investido', valor: money(valor) },
        { rotulo: 'Queda do ativo', valor: `−${queda}%` },
        { rotulo: 'Sobrou', valor: money(aposQuedaCents) },
      ]}
      palpites={[
        { id: 'bem-mais', rotulo: `Mais de ${queda + 10}%` },
        { id: 'mesma', rotulo: `${queda}%, o mesmo que caiu` },
        { id: 'pouco-mais', rotulo: `Entre ${queda}% e ${queda + 10}%` },
      ]}
      resultado={{
        rotulo: 'Precisa subir, só pra empatar',
        valor: alta,
        nota: `pra ${money(aposQuedaCents)} voltarem a ser ${money(valor)}`,
        tom: 'ruim',
        quedaPct: queda,
        altaNecessariaPct,
      }}
      respostaCerta={(r) => palpiteCertoDaVolatilidade(r.quedaPct, r.altaNecessariaPct)}
      explicacao={
        <p>
          <Selo tipo="queda" />
          Depois de cair <b>{queda}%</b>, seu ativo precisa subir <b>{alta}</b> só para voltar aos {money(valor)}{' '}
          iniciais!
        </p>
      }
      principal={
        <CampoRegua
          rotulo="Queda em cripto / ativo volátil"
          valor={queda}
          min={10}
          max={60}
          passo={5}
          onChange={setQueda}
          formatar={(v) => `−${v}%`}
        />
      }
      resumoExtras={`Valor investido de ${money(valor)}`}
      extras={
        <CampoDinheiro
          rotulo="Valor investido"
          valor={valor}
          min={50_000}
          max={2_000_000}
          passo={50_000}
          onChange={setValor}
        />
      }
      detalhes={
        <Quadros
          itens={[
            { rotulo: `Cripto (−${queda}%)`, valor: money(aposQuedaCents), tom: 'ruim' },
            { rotulo: 'Renda Fixa (+1%)', valor: money(rendaFixaCents), tom: 'bom' },
          ]}
        />
      }
    />
  );
}
