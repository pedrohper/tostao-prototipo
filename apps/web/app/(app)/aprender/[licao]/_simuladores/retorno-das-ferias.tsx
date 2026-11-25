'use client';
// m6-l4: A conta do retorno das férias, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoOpcoes, Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { valorQueCabe } from './apoio-m6-m8';

export function calcularRetornoDasFerias({ salarioCents, gastouTudo }: { salarioCents: number; gastouTudo: boolean }) {
  const tercoCents = Math.round(salarioCents / 3);
  const entraNaSaidaCents = salarioCents + tercoCents;
  const saldoNaVoltaCents = gastouTudo ? 0 : salarioCents;
  return { tercoCents, entraNaSaidaCents, saldoNaVoltaCents };
}

export type PalpiteDasFerias = 'nada' | 'salario' | 'terco';

export function palpiteCertoDasFerias(salarioCents: number, saldoNaVoltaCents: number): PalpiteDasFerias {
  if (saldoNaVoltaCents <= 0) return 'nada';
  return saldoNaVoltaCents >= salarioCents ? 'salario' : 'terco';
}

type Plano = 'gastar' | 'guardar';

export function ContaRetornoFerias() {
  const [salario, setSalario] = useState(300_000);
  const [plano, setPlano] = useState<Plano>('gastar');
  const gastouTudo = plano === 'gastar';

  const { tercoCents, entraNaSaidaCents, saldoNaVoltaCents } = calcularRetornoDasFerias({
    salarioCents: salario,
    gastouTudo,
  });

  return (
    <SimuladorShell
      pergunta="Na volta das férias, quanto sobra pra pagar o mês?"
      cenario={[
        { rotulo: 'Salário mensal líquido', valor: money(salario) },
        { rotulo: 'Caiu antes de viajar', valor: money(entraNaSaidaCents) },
        { rotulo: 'O plano', valor: gastouTudo ? 'Gastar tudo' : 'Guardar' },
      ]}
      palpites={[
        { id: 'nada', rotulo: `Nada: ${money(0)}` },
        { id: 'salario', rotulo: `Um salário inteiro: ${money(salario)}` },
        { id: 'terco', rotulo: `Só o 1/3: ${money(tercoCents)}` },
      ]}
      resultado={{
        rotulo: 'Saldo no mês de volta',
        valor: valorQueCabe(money(saldoNaVoltaCents), 'no mês'),
        nota: gastouTudo ? 'Buraco no orçamento!' : 'Contas do mês cobertas',
        tom: gastouTudo ? 'ruim' : 'bom',
        salarioCents: salario,
        saldoNaVoltaCents,
      }}
      respostaCerta={(r) => palpiteCertoDasFerias(r.salarioCents, r.saldoNaVoltaCents)}
      explicacao={
        <p>
          <Selo tipo={gastouTudo ? 'perigo' : 'ok'} />
          {gastouTudo
            ? `Se você gastar os ${money(entraNaSaidaCents)} viajando, na volta das férias o próximo salário já foi adiantado — sobra ${money(0)} para pagar aluguel e mercado.`
            : `Separando ${money(salario)} para o mês seguinte, você curte as férias com o 1/3 extra (${money(tercoCents)}) sem cair no rotativo na volta.`}
        </p>
      }
      principal={
        <CampoOpcoes<Plano>
          rotulo="O que fazer com o dinheiro das férias"
          opcoes={[
            { id: 'gastar', rotulo: 'Gastar tudo nas férias' },
            { id: 'guardar', rotulo: 'Guardar o adiantamento' },
          ]}
          valor={plano}
          onChange={setPlano}
          empilhado
        />
      }
      resumoExtras={`Salário líquido de ${money(salario)}`}
      extras={
        <CampoDinheiro
          rotulo="Salário mensal líquido"
          valor={salario}
          min={150_000}
          max={1_000_000}
          passo={10_000}
          onChange={setSalario}
        />
      }
      detalhes={
        <Quadros
          titulo="Na saída das férias"
          itens={[
            {
              rotulo: 'Adiantamento + 1/3',
              valor: money(entraNaSaidaCents),
              nota: `Extra real é só ${money(tercoCents)}`,
            },
          ]}
        />
      }
    />
  );
}
