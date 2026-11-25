'use client';
// m3-l1: Termômetro de sangria, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoLista, Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type DividaDaSangria = { id: string; nome: string; saldoCents: number; taxa: number; ativa: boolean };

const DIVIDAS_INICIAIS: DividaDaSangria[] = [
  { id: 'rotativo', nome: 'Cartão rotativo', saldoCents: 150_000, taxa: 14, ativa: true },
  { id: 'cheque', nome: 'Cheque especial', saldoCents: 100_000, taxa: 8, ativa: true },
  { id: 'emprestimo', nome: 'Empréstimo pessoal', saldoCents: 250_000, taxa: 4, ativa: true },
];

export function calcularSangria(dividas: readonly DividaDaSangria[]) {
  const porDivida = dividas.map((d) => ({
    ...d,
    jurosCents: Math.round(d.saldoCents * (d.taxa / 100)),
    mesesDobra: d.taxa > 0 ? Math.log(2) / Math.log(1 + d.taxa / 100) : Infinity,
  }));
  const ordemDeAtaque = porDivida.filter((d) => d.ativa).sort((a, b) => b.taxa - a.taxa);
  const totalCents = ordemDeAtaque.reduce((acc, d) => acc + d.jurosCents, 0);
  return { porDivida, ordemDeAtaque, totalCents };
}

export type PalpiteDaSangria = 'pouco' | 'meio' | 'muito';

/**
 * As faixas do palpite: 5% e 10% do que está marcado. Sem nada marcado usa a soma de todas, pra as opções não virarem
 * três vezes "R$ 0,00".
 */
export function faixasDaSangria(dividas: readonly DividaDaSangria[]) {
  const soma = (lista: readonly DividaDaSangria[]) => lista.reduce((acc, d) => acc + d.saldoCents, 0);
  const base = soma(dividas.filter((d) => d.ativa)) || soma(dividas);
  return { baixoCents: Math.round(base * 0.05), altoCents: Math.round(base * 0.1) };
}

export function palpiteCertoDaSangria(
  jurosCents: number,
  faixas: { baixoCents: number; altoCents: number },
): PalpiteDaSangria {
  if (jurosCents < faixas.baixoCents) return 'pouco';
  return jurosCents <= faixas.altoCents ? 'meio' : 'muito';
}

export function TermometroDeSangria() {
  const [dividas, setDividas] = useState(DIVIDAS_INICIAIS);

  const atualizar = (id: string, patch: Partial<DividaDaSangria>) => {
    setDividas((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const { porDivida, ordemDeAtaque, totalCents } = calcularSangria(dividas);
  const faixas = faixasDaSangria(dividas);
  const ativas = porDivida.filter((d) => d.ativa);

  return (
    <SimuladorShell
      pergunta="Quanto essas dívidas comem por mês, só em juros?"
      cenario={ativas.map((d) => ({ rotulo: `${d.nome} (${d.taxa}%/mês)`, valor: money(d.saldoCents) }))}
      palpites={[
        { id: 'pouco', rotulo: `Menos de ${money(faixas.baixoCents)}` },
        { id: 'meio', rotulo: `De ${money(faixas.baixoCents)} a ${money(faixas.altoCents)}` },
        { id: 'muito', rotulo: `Mais de ${money(faixas.altoCents)}` },
      ]}
      resultado={{
        rotulo: 'Sangria mensal total em juros',
        valor: money(totalCents),
        nota: 'por mês, só de juros',
        tom: totalCents > 0 ? 'ruim' : 'bom',
        totalCents,
      }}
      respostaCerta={(r) => palpiteCertoDaSangria(r.totalCents, faixas)}
      explicacao={
        ordemDeAtaque.length > 0 ? (
          <p>
            <Selo tipo="fogo" />
            <b>Ordem de ataque (da mais cara p/ mais barata):</b>{' '}
            {ordemDeAtaque.map((d, i) => `${i + 1}º ${d.nome} (${d.taxa}%)`).join(' → ')}.
          </p>
        ) : (
          <p>Nenhuma dívida na conta. Marque pelo menos uma pra ver a ordem de ataque.</p>
        )
      }
      principal={
        <CampoLista
          rotulo="Dívidas ativas"
          itens={porDivida.map((d) => ({ id: d.id, rotulo: d.nome, valor: money(d.saldoCents) }))}
          marcados={ativas.map((d) => d.id)}
          onAlternar={(id) => atualizar(id, { ativa: !dividas.find((d) => d.id === id)?.ativa })}
        />
      }
      resumoExtras="O saldo de cada dívida marcada"
      extras={
        ativas.length > 0 ? (
          <>
            {ativas.map((d) => (
              <CampoDinheiro
                key={d.id}
                rotulo={`Saldo: ${d.nome}`}
                valor={d.saldoCents}
                min={30_000}
                max={600_000}
                passo={10_000}
                onChange={(saldoCents) => atualizar(d.id, { saldoCents })}
              />
            ))}
          </>
        ) : undefined
      }
      detalhes={
        <Quadros
          titulo="Sangria por dívida"
          itens={porDivida.map((d) => ({
            rotulo: d.nome,
            valor: d.ativa ? `${money(d.jurosCents)}/mês` : 'Fora da conta',
            nota: `${d.taxa}%/mês · dobra em ${d.mesesDobra.toFixed(1).replace('.', ',')}m`,
            tom: d.ativa ? ('ruim' as const) : undefined,
          }))}
        />
      }
    />
  );
}
