'use client';
// m2-l1: Ilusão de poder, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export const DIAS_UTEIS_NO_MES = 22;

export type LimiteEntrada = { limiteCents: number; rendaCents: number };

export function calcularIlusaoDePoder({ limiteCents, rendaCents }: LimiteEntrada) {
  return {
    diariaCents: Math.round(rendaCents / DIAS_UTEIS_NO_MES),
    diasDeTrabalho: Math.round((limiteCents / rendaCents) * DIAS_UTEIS_NO_MES),
    multiplo: limiteCents / rendaCents,
  };
}

export type PalpiteDoLimite = 'meio-mes' | 'um-mes' | 'mais';

/** Até 11 dias úteis (meio mês), de 12 a 22, ou mais que um mês inteiro. */
export function palpiteCertoDoLimite(diasDeTrabalho: number): PalpiteDoLimite {
  if (diasDeTrabalho <= 11) return 'meio-mes';
  return diasDeTrabalho <= DIAS_UTEIS_NO_MES ? 'um-mes' : 'mais';
}

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

export function IlusaoDePoder() {
  const [limite, setLimite] = useState(350_000);
  const [renda, setRenda] = useState(220_000);

  const { diariaCents, diasDeTrabalho, multiplo } = calcularIlusaoDePoder({ limiteCents: limite, rendaCents: renda });
  const acimaDaRenda = multiplo > 1;

  return (
    <SimuladorShell
      pergunta="Se estourar o limite, quantos dias de trabalho ele custa?"
      cenario={[
        { rotulo: 'Limite do cartão', valor: money(limite) },
        { rotulo: 'Sua renda mensal real', valor: money(renda) },
        { rotulo: 'Dias úteis no mês', valor: String(DIAS_UTEIS_NO_MES) },
      ]}
      palpites={[
        { id: 'meio-mes', rotulo: 'Até 11 dias (meio mês)' },
        { id: 'um-mes', rotulo: 'De 12 a 22 dias' },
        { id: 'mais', rotulo: 'Mais de 22 dias (passa de um mês)' },
      ]}
      resultado={{
        rotulo: 'Dias de trabalho pra quitar o limite',
        valor: dias(diasDeTrabalho),
        nota: `Seu dia útil vale ${money(diariaCents)}`,
        tom: acimaDaRenda ? 'ruim' : 'bom',
        diasDeTrabalho,
      }}
      respostaCerta={(r) => palpiteCertoDoLimite(r.diasDeTrabalho)}
      explicacao={
        acimaDaRenda ? (
          <p>
            <Selo tipo="alerta" />
            <b>Armadilha do limite alto:</b> seu limite equivale a <b>{multiplo.toFixed(1).replace('.', ',')}x</b> a sua
            renda mensal. Estourar o cartão significa trabalhar <b>{diasDeTrabalho} dias úteis inteiros</b> (base 22
            dias/mês) só para empatar — sem contar os juros.
          </p>
        ) : (
          <p>
            <Selo tipo="ok" />
            <b>Limite sob controle:</b> seu limite representa <b>{Math.round(multiplo * 100)}%</b> da sua renda mensal (
            {diasDeTrabalho === 1 ? '1 dia útil' : `${diasDeTrabalho} dias úteis`}). Mesmo assim, limite não é extensão
            do salário.
          </p>
        )
      }
      principal={
        <CampoDinheiro
          rotulo="Limite do cartão"
          valor={limite}
          min={50_000}
          max={1_500_000}
          passo={25_000}
          onChange={setLimite}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Com renda de ${money(renda)} por mês`}
      extras={
        <CampoDinheiro
          rotulo="Sua renda mensal real"
          valor={renda}
          min={120_000}
          max={1_000_000}
          passo={10_000}
          onChange={setRenda}
        />
      }
      detalhes={<Quadros itens={[{ rotulo: 'Valor do seu dia útil', valor: money(diariaCents), tom: 'atencao' }]} />}
    />
  );
}
