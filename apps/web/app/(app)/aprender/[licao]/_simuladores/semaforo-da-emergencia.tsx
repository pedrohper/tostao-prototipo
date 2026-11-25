'use client';
// m4-l3: O teste do semáforo da emergência, no SimuladorShell (T6.15). A regra das 3 perguntas é a de sempre.
import { useState } from 'react';
import { CampoSimNao } from '@/components/simulador-campos';
import { SimuladorShell, type TomDoResultado } from '@/components/simulador-shell';

export type RespostasDoSemaforo = { inesperado: boolean; urgente: boolean; alternativa: boolean };
export type CorDoSemaforo = 'verde' | 'amarelo' | 'vermelho';

export function classificarEmergencia({ inesperado, urgente, alternativa }: RespostasDoSemaforo): {
  cor: CorDoSemaforo;
  titulo: string;
  texto: string;
} {
  if (inesperado && urgente && !alternativa) {
    return {
      cor: 'verde',
      titulo: 'Sinal Verde — Emergência real',
      texto:
        'É inesperado, urgente e não há opção mais barata. É exatamente para isso que sua reserva existe: use sem culpa e planeje a reposição.',
    };
  }
  if (!inesperado && !urgente) {
    return {
      cor: 'vermelho',
      titulo: 'Sinal Vermelho — Desejo disfarçado',
      texto:
        'Não é inesperado nem urgente. Não toque na reserva! Se você quer isso, crie uma caixinha separada e junte antes.',
    };
  }
  return {
    cor: 'amarelo',
    titulo: 'Sinal Amarelo — Adie 7 dias ou reduza',
    texto: alternativa
      ? 'Existe uma alternativa mais barata: resolva pelo menor custo possível antes de mexer no seu colchão.'
      : 'Espere 7 dias ou reajuste o orçamento do mês antes de sacar da reserva.',
  };
}

export type PalpiteDoSemaforo = CorDoSemaforo;

export const palpiteCertoDoSemaforo = (cor: CorDoSemaforo): PalpiteDoSemaforo => cor;

const TOM: Record<CorDoSemaforo, TomDoResultado> = { verde: 'bom', amarelo: 'atencao', vermelho: 'ruim' };
const simOuNao = (v: boolean) => (v ? 'sim' : 'não');

export function SemaforoDaEmergencia() {
  const [inesperado, setInesperado] = useState(true);
  const [urgente, setUrgente] = useState(true);
  const [alternativa, setAlternativa] = useState(false);

  const veredito = classificarEmergencia({ inesperado, urgente, alternativa });

  return (
    <SimuladorShell
      pergunta="Dá pra mexer na reserva por causa desse gasto?"
      cenario={[
        { rotulo: 'Exemplo: o notebook que você usa pra trabalhar pifou', valor: 'hoje' },
        { rotulo: 'Foi algo inesperado?', valor: simOuNao(inesperado) },
        { rotulo: 'É essencial / urgente hoje?', valor: simOuNao(urgente) },
        { rotulo: 'Tem alternativa mais barata?', valor: simOuNao(alternativa) },
      ]}
      palpites={[
        { id: 'vermelho', rotulo: 'Sinal vermelho: não toca na reserva' },
        { id: 'amarelo', rotulo: 'Sinal amarelo: adia ou reduz' },
        { id: 'verde', rotulo: 'Sinal verde: é emergência real' },
      ]}
      resultado={{
        rotulo: 'Veredito do semáforo',
        valor: veredito.titulo,
        tom: TOM[veredito.cor],
        cor: veredito.cor,
      }}
      respostaCerta={(r) => palpiteCertoDoSemaforo(r.cor)}
      explicacao={<p>{veredito.texto}</p>}
      principal={<CampoSimNao rotulo="1. Foi algo inesperado?" valor={inesperado} onChange={setInesperado} />}
      resumoExtras={`Urgente hoje: ${simOuNao(urgente)} · alternativa mais barata: ${simOuNao(alternativa)}`}
      extras={
        <>
          <CampoSimNao rotulo="2. É essencial / urgente hoje?" valor={urgente} onChange={setUrgente} />
          <CampoSimNao rotulo="3. Tem alternativa mais barata?" valor={alternativa} onChange={setAlternativa} />
        </>
      }
    />
  );
}
