'use client';
// m8-l3: Aposta individual vs. índice, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { QuadrosEmLinhas, valorQueCabe } from './apoio-m6-m8';

export function compararApostaComIndice({ valorCents }: { valorCents: number }) {
  const acaoUnicaCents = Math.round(valorCents * 0.6); // -40%
  const etfIndiceCents = Math.round(valorCents * Math.pow(1.1, 5)); // +10% a.a. por 5 anos (~+61%)
  return { acaoUnicaCents, etfIndiceCents, diferencaCents: etfIndiceCents - acaoUnicaCents };
}

export type PalpiteDaAposta = 'grande' | 'media' | 'pequena';

/** Fronteiras dos palpites: 25% e 80% do capital. */
export const faixasDaAposta = (valorCents: number) => ({
  pequenaCents: Math.round(valorCents * 0.25),
  grandeCents: Math.round(valorCents * 0.8),
});

export function palpiteCertoDaAposta(valorCents: number, diferencaCents: number): PalpiteDaAposta {
  const { pequenaCents, grandeCents } = faixasDaAposta(valorCents);
  if (diferencaCents <= pequenaCents) return 'pequena';
  return diferencaCents <= grandeCents ? 'media' : 'grande';
}

export function ApostaIndividualVsIndice() {
  const [valor, setValor] = useState(500_000);

  const { acaoUnicaCents, etfIndiceCents, diferencaCents } = compararApostaComIndice({ valorCents: valor });
  const { pequenaCents, grandeCents } = faixasDaAposta(valor);

  return (
    <SimuladorShell
      pergunta="Uma ação só que despenca ou um índice inteiro: qual é a distância no fim?"
      cenario={[
        { rotulo: 'Capital investido', valor: money(valor) },
        { rotulo: '1 ação só', valor: 'caiu 40%' },
        { rotulo: 'ETF de índice, 5 anos', valor: '~10% a.a.' },
      ]}
      palpites={[
        { id: 'grande', rotulo: `Mais de ${money(grandeCents)}` },
        { id: 'media', rotulo: `Entre ${money(pequenaCents)} e ${money(grandeCents)}` },
        { id: 'pequena', rotulo: `Até ${money(pequenaCents)}` },
      ]}
      resultado={{
        rotulo: 'Diferença entre os dois caminhos',
        valor: valorQueCabe(money(diferencaCents), 'de diferença'),
        nota: 'A favor do índice, neste cenário',
        tom: 'atencao',
        valorCents: valor,
        diferencaCents,
      }}
      respostaCerta={(r) => palpiteCertoDaAposta(r.valorCents, r.diferencaCents)}
      explicacao={
        <p>
          <Selo tipo="meta" />
          Diferença de <b>{money(diferencaCents)}</b>: uma empresa isolada pode quebrar ou perder mercado; um índice
          amplo dilui o risco entre dezenas de companhias.
        </p>
      }
      principal={
        <CampoDinheiro
          rotulo="Capital investido"
          valor={valor}
          min={100_000}
          max={2_000_000}
          passo={50_000}
          onChange={setValor}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      detalhes={
        <QuadrosEmLinhas
          itens={[
            {
              rotulo: '1 Ação (queda de −40%)',
              valor: money(acaoUnicaCents),
              tom: 'ruim',
              nota: 'Risco concentrado',
            },
            {
              rotulo: 'ETF Índice (5 anos)',
              valor: money(etfIndiceCents),
              tom: 'bom',
              nota: 'Média ~10% a.a. (+61%)',
            },
          ]}
        />
      }
    />
  );
}
