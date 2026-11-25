'use client';
// m1-l3: O bisturi no fixo, no SimuladorShell (T6.15). A soma é a de sempre.
import { useState } from 'react';
import { PresetHint } from '@/components/preset-hint';
import { Selo } from '@/components/selo';
import { CampoLista, Quadros } from '@/components/simulador-campos';
import { SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { bisturiItems } from '@/lib/lesson-context';
import { palpiteCertoEmValor, palpitesEmVolta, type PalpiteDeValor } from './palpites-lote-a';
import type { SimulatorProps } from './tipos';

/** `mensal` em centavos. */
export type ItemDoBisturi = { id: string; label: string; mensal: number };

export const BISTURI_GENERICOS: readonly ItemDoBisturi[] = [
  { id: 'celular', label: 'Plano celular pós-pago (renegociar p/ controle)', mensal: 4500 },
  { id: 'streaming1', label: 'Streaming extra que você mal abre', mensal: 3990 },
  { id: 'academia', label: 'Academia não utilizada no mês', mensal: 8990 },
  { id: 'musica', label: 'Plano de música individual (mudar p/ família)', mensal: 1500 },
  { id: 'internet', label: 'Internet em velocidade acima da necessária', mensal: 4000 },
];

export function calcularBisturi(itens: readonly ItemDoBisturi[], marcados: readonly string[]) {
  const mensalCents = itens.reduce((acc, it) => acc + (marcados.includes(it.id) ? it.mensal : 0), 0);
  return { mensalCents, anualCents: mensalCents * 12 };
}

export const palpitesDoBisturi = (mensalCents: number) =>
  palpitesEmVolta(mensalCents * 12, Math.floor(mensalCents / 100));

export const palpiteCertoDoBisturi = (opcoes: readonly PalpiteDeValor[], anualCents: number) =>
  palpiteCertoEmValor(opcoes, anualCents);

export function BisturiNoFixo({ userContext = null }: SimulatorProps) {
  // Com extrato: as assinaturas que o Tostão achou. Sem: a lista didática de sempre.
  const reais = bisturiItems(userContext);
  const itens = reais ?? BISTURI_GENERICOS;
  const [marcados, setMarcados] = useState<string[]>(reais ? [] : ['celular']);

  const cortados = calcularBisturi(itens, marcados);
  const listaToda = calcularBisturi(
    itens,
    itens.map((it) => it.id),
  );
  const cortou = cortados.mensalCents > 0;
  // Sem nada marcado (é o começo de quem tem extrato), o número grande mostra o que a lista inteira liberaria.
  const base = cortou ? cortados : listaToda;
  const opcoes = base.mensalCents > 0 ? palpitesDoBisturi(base.mensalCents) : [];

  const alternar = (id: string) =>
    setMarcados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  return (
    <SimuladorShell
      pergunta="Passando o bisturi, quanto dá pra liberar em 1 ano?"
      aviso={reais && <PresetHint>Estas são as assinaturas que o Tostão achou no seu extrato.</PresetHint>}
      cenario={
        cortou
          ? [
              {
                rotulo: 'Marcados pra cortar',
                valor: `${itens.filter((it) => marcados.includes(it.id)).length} de ${itens.length}`,
              },
              { rotulo: 'Esses cortes aliviam por mês', valor: money(cortados.mensalCents) },
            ]
          : [
              { rotulo: reais ? 'Assinaturas na lista' : 'Gastos na lista', valor: String(itens.length) },
              { rotulo: 'A lista toda custa por mês', valor: money(listaToda.mensalCents) },
            ]
      }
      palpites={opcoes.map((o) => ({ id: o.id, rotulo: `Uns ${money(o.cents)}` }))}
      resultado={{
        rotulo: cortou ? 'Guardado em 1 ano' : 'Cortando a lista toda, em 1 ano',
        valor: money(base.anualCents),
        nota: cortou ? `${money(cortados.mensalCents)} de alívio todo mês` : 'Você ainda não marcou nada.',
        tom: cortou ? 'bom' : 'atencao',
        anualCents: base.anualCents,
      }}
      respostaCerta={opcoes.length ? (r) => palpiteCertoDoBisturi(opcoes, r.anualCents) : undefined}
      explicacao={
        cortou ? (
          <p>
            <Selo tipo="dica" />
            <b>Poder do fixo:</b> cancelar ou renegociar dá trabalho uma única vez, mas o alívio de{' '}
            <b>{money(cortados.mensalCents)}</b> cai na sua conta todo mês no piloto automático.
          </p>
        ) : (
          <p>Toque nas opções abaixo para ver o impacto no ano.</p>
        )
      }
      principal={
        <CampoLista
          rotulo="Selecione quais gastos fixos você toparia cortar ou renegociar para passar o bisturi:"
          itens={itens.map((it) => ({ id: it.id, rotulo: it.label, valor: `${money(it.mensal)}/mês` }))}
          marcados={marcados}
          onAlternar={alternar}
          riscarMarcados
        />
      }
      detalhes={<Quadros itens={[{ rotulo: 'Alívio todo mês', valor: money(cortados.mensalCents), tom: 'bom' }]} />}
    />
  );
}
