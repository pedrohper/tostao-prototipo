'use client';
// m3-l2: Avalanche vs. Bola de neve, no SimuladorShell (T6.15). A simulação mês a mês é a de sempre, agora recebendo o
// aporte extra já em centavos.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoOpcoes, Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type Metodo = 'avalanche' | 'bola';

/** Saldo e pagamento mínimo em centavos; taxa ao mês em fração. */
type DividaBase = { id: string; nome: string; saldo: number; taxa: number; min: number };

const BASE: readonly DividaBase[] = [
  { id: 'cartao', nome: 'Cartão (14%/m)', saldo: 180000, taxa: 0.14, min: 27000 },
  { id: 'carne', nome: 'Loja/Carnê (6%/m)', saldo: 60000, taxa: 0.06, min: 9000 },
  { id: 'emp', nome: 'Empréstimo (3,5%/m)', saldo: 300000, taxa: 0.035, min: 20000 },
];

export function simularMetodo(estrategia: Metodo, extraCents: number) {
  const itens = BASE.map((d) => ({ ...d }));
  let totalJuros = 0;
  let meses = 0;
  let primeiraQuitadaMes = 0;

  while (itens.some((d) => d.saldo > 0) && meses < 120) {
    meses++;
    // Aplica juros do mês
    for (const d of itens) {
      if (d.saldo > 0) {
        const juro = Math.round(d.saldo * d.taxa);
        d.saldo += juro;
        totalJuros += juro;
      }
    }

    // Paga mínimos
    let sobra = extraCents;
    for (const d of itens) {
      if (d.saldo > 0) {
        const pag = Math.min(d.saldo, d.min);
        d.saldo -= pag;
        if (pag < d.min) sobra += d.min - pag;
      } else {
        sobra += d.min;
      }
    }

    // Direciona aporte extra pela estratégia
    const ativas = itens.filter((d) => d.saldo > 0);
    ativas.sort((a, b) => (estrategia === 'avalanche' ? b.taxa - a.taxa : a.saldo - b.saldo));

    for (const alvo of ativas) {
      if (sobra <= 0) break;
      const pag = Math.min(alvo.saldo, sobra);
      alvo.saldo -= pag;
      sobra -= pag;
    }

    if (primeiraQuitadaMes === 0 && itens.some((d) => d.saldo === 0)) {
      primeiraQuitadaMes = meses;
    }
  }

  return { totalJuros, meses, primeiraQuitadaMes };
}

export function compararMetodos(extraCents: number) {
  const avalanche = simularMetodo('avalanche', extraCents);
  const bola = simularMetodo('bola', extraCents);
  return { avalanche, bola, economiaCents: bola.totalJuros - avalanche.totalJuros };
}

export type PalpiteDaAvalanche = 'pouco' | 'meio' | 'muito';

/** As faixas do palpite saem do aporte: metade dele e o dobro dele. */
export const faixasDaEconomia = (extraCents: number) => ({
  baixoCents: Math.round(extraCents / 2),
  altoCents: extraCents * 2,
});

export function palpiteCertoDaAvalanche(extraCents: number, economiaCents: number): PalpiteDaAvalanche {
  const { baixoCents, altoCents } = faixasDaEconomia(extraCents);
  if (economiaCents < baixoCents) return 'pouco';
  return economiaCents <= altoCents ? 'meio' : 'muito';
}

const NOMES: Record<Metodo, string> = { avalanche: 'Avalanche', bola: 'Bola de neve' };
const emMeses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`;

export function AvalancheVsBolaDeNeve() {
  const [metodo, setMetodo] = useState<Metodo>('avalanche');
  const [extra, setExtra] = useState(25_000);

  const comparacao = compararMetodos(extra);
  const { economiaCents, bola } = comparacao;
  const atual = comparacao[metodo];
  const faixas = faixasDaEconomia(extra);
  const economiza = economiaCents > 0;

  return (
    <SimuladorShell
      pergunta="Atacando o juro mais alto primeiro (Avalanche), quanto você economiza?"
      cenario={[
        ...BASE.map((d) => ({ rotulo: d.nome, valor: money(d.saldo) })),
        { rotulo: 'Extra por mês, além dos mínimos', valor: money(extra) },
        { rotulo: 'A outra (Bola de neve) ataca antes', valor: 'o menor saldo' },
      ]}
      palpites={[
        { id: 'pouco', rotulo: `Menos de ${money(faixas.baixoCents)}` },
        { id: 'meio', rotulo: `De ${money(faixas.baixoCents)} a ${money(faixas.altoCents)}` },
        { id: 'muito', rotulo: `Mais de ${money(faixas.altoCents)}` },
      ]}
      resultado={{
        rotulo: economiza ? 'A Avalanche economiza' : 'Em juros, os dois métodos',
        valor: economiza ? money(economiaCents) : 'Empatam',
        nota: economiza ? 'em juros, comparada com a Bola de neve' : undefined,
        tom: economiza ? 'bom' : 'atencao',
        economiaCents,
      }}
      respostaCerta={(r) => palpiteCertoDaAvalanche(extra, r.economiaCents)}
      explicacao={
        <p>
          <Selo tipo="dados" />
          <b>Comparativo ({atual.meses} meses p/ zerar tudo):</b>{' '}
          {economiza ? (
            <>
              a <b>Avalanche</b> economiza <b>{money(economiaCents)}</b> em juros, enquanto a <b>Bola de Neve</b> dá
              vitória rápida na 1ª dívida em <b>{emMeses(bola.primeiraQuitadaMes)}</b>.
            </>
          ) : (
            'Os dois métodos empatam em juros com esse aporte. Escolha o que te der mais fôlego emocional!'
          )}
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Aporte extra mensal"
          valor={extra}
          min={5_000}
          max={80_000}
          passo={5_000}
          onChange={setExtra}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Os quadros abaixo mostram o método ${NOMES[metodo]}`}
      extras={
        <CampoOpcoes
          rotulo="Ver os números de qual método"
          opcoes={[
            { id: 'avalanche', rotulo: 'Avalanche (maior juro)' },
            { id: 'bola', rotulo: 'Bola de neve (menor saldo)' },
          ]}
          valor={metodo}
          onChange={setMetodo}
          empilhado
        />
      }
      detalhes={
        <Quadros
          titulo={`Método ${NOMES[metodo]}`}
          itens={[
            { rotulo: '1ª dívida quitada', valor: emMeses(atual.primeiraQuitadaMes), tom: 'atencao' },
            { rotulo: 'Total de juros pagos', valor: money(atual.totalJuros), tom: 'ruim' },
            { rotulo: 'Tudo zerado em', valor: emMeses(atual.meses) },
          ]}
        />
      }
    />
  );
}
