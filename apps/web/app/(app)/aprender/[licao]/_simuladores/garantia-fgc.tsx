'use client';
// m7-l2: Raio-x da garantia FGC, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export const LIMITE_POR_BANCO_CENTS = 25_000_000;
export const TETO_GLOBAL_CENTS = 100_000_000;

export function calcularGarantiaFgc({ bancosCents }: { bancosCents: readonly number[] }) {
  const totalCents = bancosCents.reduce((acc, v) => acc + v, 0);
  const cobertoPorBanco = bancosCents.reduce((acc, v) => acc + Math.min(v, LIMITE_POR_BANCO_CENTS), 0);
  const cobertoCents = Math.min(cobertoPorBanco, TETO_GLOBAL_CENTS);
  return { totalCents, cobertoCents, descobertoCents: totalCents - cobertoCents };
}

export type PalpiteDoFgc = 'nada' | 'ate' | 'mais';

/** Fronteira entre "até" e "mais de": R$ 100 mil sem garantia. */
export const CORTE_DO_PALPITE_FGC_CENTS = 10_000_000;

export function palpiteCertoDoFgc(descobertoCents: number): PalpiteDoFgc {
  if (descobertoCents <= 0) return 'nada';
  return descobertoCents <= CORTE_DO_PALPITE_FGC_CENTS ? 'ate' : 'mais';
}

export function RaioXGarantiaFGC() {
  const [bancoA, setBancoA] = useState(18_000_000);
  const [bancoB, setBancoB] = useState(28_000_000);
  const [bancoC, setBancoC] = useState(15_000_000);

  const { totalCents, cobertoCents, descobertoCents } = calcularGarantiaFgc({
    bancosCents: [bancoA, bancoB, bancoC],
  });
  const bancos = [
    { nome: 'Banco A', valor: bancoA },
    { nome: 'Banco B', valor: bancoB },
    { nome: 'Banco C', valor: bancoC },
  ];
  const corte = money(CORTE_DO_PALPITE_FGC_CENTS);
  const campo = (rotulo: string, valor: number, onChange: (v: number) => void, dica?: string) => (
    <CampoDinheiro
      rotulo={rotulo}
      valor={valor}
      min={0}
      max={50_000_000}
      passo={1_000_000}
      onChange={onChange}
      dica={dica}
    />
  );

  return (
    <SimuladorShell
      pergunta="Se esses bancos quebrarem, quanto do seu dinheiro fica sem garantia?"
      cenario={[
        ...bancos.map((b) => ({ rotulo: b.nome, valor: money(b.valor) })),
        { rotulo: 'FGC cobre, por banco', valor: 'R$ 250 mil' },
        { rotulo: 'Teto por CPF (4 anos)', valor: 'R$ 1 milhão' },
      ]}
      palpites={[
        { id: 'nada', rotulo: 'Nada, tá tudo coberto' },
        { id: 'ate', rotulo: `Uma parte, até ${corte}` },
        { id: 'mais', rotulo: `Mais de ${corte}` },
      ]}
      resultado={{
        rotulo: 'Sem garantia (risco)',
        valor: money(descobertoCents),
        nota: `${money(cobertoCents)} protegidos pelo FGC`,
        tom: descobertoCents > 0 ? 'ruim' : 'bom',
        descobertoCents,
      }}
      respostaCerta={(r) => palpiteCertoDoFgc(r.descobertoCents)}
      explicacao={
        <p>
          <Selo tipo={totalCents > TETO_GLOBAL_CENTS || descobertoCents > 0 ? 'alerta' : 'ok'} />
          {totalCents > TETO_GLOBAL_CENTS
            ? 'Atenção: você ultrapassou o teto global de R$ 1 milhão por CPF a cada 4 anos!'
            : descobertoCents > 0
              ? `Você tem ${money(descobertoCents)} acima do limite de R$ 250 mil por instituição. Dividir entre bancos diferentes resolve!`
              : 'Tudo coberto! Nenhum banco passa de R$ 250 mil e o total está dentro do teto de R$ 1 milhão.'}
        </p>
      }
      principal={campo('Banco B', bancoB, setBancoB, 'Arraste ou toque no número pra digitar.')}
      resumoExtras={`Banco A com ${money(bancoA)} e Banco C com ${money(bancoC)}`}
      extras={
        <>
          {campo('Banco A', bancoA, setBancoA)}
          {campo('Banco C', bancoC, setBancoC)}
        </>
      }
      detalhes={
        <>
          <Quadros
            itens={[
              { rotulo: 'Protegido pelo FGC', valor: money(cobertoCents), tom: 'bom' },
              {
                rotulo: 'Sem garantia (risco)',
                valor: money(descobertoCents),
                tom: descobertoCents > 0 ? 'ruim' : undefined,
              },
            ]}
          />
          <Quadros
            titulo="Banco por banco"
            itens={bancos.map((b) => {
              const passou = b.valor > LIMITE_POR_BANCO_CENTS;
              return {
                rotulo: b.nome,
                valor: money(b.valor),
                tom: passou ? ('ruim' as const) : undefined,
                nota: passou ? 'Acima de R$ 250 mil!' : undefined,
              };
            })}
          />
        </>
      }
    />
  );
}
