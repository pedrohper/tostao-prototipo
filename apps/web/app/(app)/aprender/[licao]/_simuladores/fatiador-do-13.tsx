'use client';
// m6-l3: Fatiador do 13º, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { valorQueCabe } from './apoio-m6-m8';

export type DecimoEntrada = { liquidoCents: number; dividasPct: number; janeiroPct: number };

export function fatiarDecimoTerceiro({ liquidoCents, dividasPct, janeiroPct }: DecimoEntrada) {
  const festasPct = Math.max(0, 100 - dividasPct - janeiroPct);
  const parc1Cents = Math.round(liquidoCents * 0.54);
  const parc2Cents = liquidoCents - parc1Cents;
  const dividasCents = Math.round((liquidoCents * dividasPct) / 100);
  // O teto só age em valor digitado com centavos quebrados (dois arredondamentos pra cima deixariam −R$ 0,01 de festa).
  const janeiroCents = Math.min(Math.round((liquidoCents * janeiroPct) / 100), liquidoCents - dividasCents);
  const festasCents = liquidoCents - dividasCents - janeiroCents;
  return { festasPct, parc1Cents, parc2Cents, dividasCents, janeiroCents, festasCents };
}

/** Quando uma fatia cresce e as duas passariam de 100%, a outra encolhe. */
export const ajustarOutraFatia = (nova: number, outra: number) => Math.min(outra, 100 - nova);

export type PalpiteDoDecimo = 'nada' | 'mais' | 'ate';

/** Fronteira do "até": um quarto do 13º. */
export const quartoDoDecimo = (liquidoCents: number) => Math.round(liquidoCents / 4);

export function palpiteCertoDoDecimo(liquidoCents: number, festasCents: number): PalpiteDoDecimo {
  if (festasCents <= 0) return 'nada';
  return festasCents <= quartoDoDecimo(liquidoCents) ? 'ate' : 'mais';
}

export function FatiadorDecimoTerceiro() {
  const [liquido, setLiquido] = useState(280_000);
  const [dividas, setDividas] = useState(50);
  const [janeiro, setJaneiro] = useState(30);

  const { festasPct, parc1Cents, parc2Cents, dividasCents, janeiroCents, festasCents } = fatiarDecimoTerceiro({
    liquidoCents: liquido,
    dividasPct: dividas,
    janeiroPct: janeiro,
  });
  const quarto = money(quartoDoDecimo(liquido));

  const mudarDividas = (v: number) => {
    setDividas(v);
    setJaneiro(ajustarOutraFatia(v, janeiro));
  };
  const mudarJaneiro = (v: number) => {
    setJaneiro(v);
    setDividas(ajustarOutraFatia(v, dividas));
  };

  return (
    <SimuladorShell
      pergunta="Pagando dívidas e janeiro, quanto do seu 13º sobra pras festas?"
      cenario={[
        { rotulo: '13º líquido total', valor: money(liquido) },
        { rotulo: 'Dívidas / cartão', valor: `${dividas}%` },
        { rotulo: 'Janeiro (IPVA, matrícula…)', valor: `${janeiro}%` },
      ]}
      palpites={[
        { id: 'nada', rotulo: 'Nada, vai tudo nas contas' },
        { id: 'mais', rotulo: `Mais de ${quarto}` },
        { id: 'ate', rotulo: `Alguma coisa, até ${quarto}` },
      ]}
      resultado={{
        rotulo: 'Sobra pras festas',
        valor: valorQueCabe(money(festasCents), 'pras festas'),
        nota: `${festasPct}% do 13º`,
        tom: festasCents > 0 ? 'bom' : 'atencao',
        liquidoCents: liquido,
        festasCents,
      }}
      respostaCerta={(r) => palpiteCertoDoDecimo(r.liquidoCents, r.festasCents)}
      explicacao={
        <p>
          1ª parcela (nov): ~<b>{money(parc1Cents)}</b> · 2ª parcela (dez, com descontos): ~<b>{money(parc2Cents)}</b>
        </p>
      }
      principal={
        <CampoRegua
          rotulo="Janeiro (IPVA, matrícula, material)"
          valor={janeiro}
          min={0}
          max={100}
          passo={5}
          onChange={mudarJaneiro}
          formatar={(v) => `${v}%`}
        />
      }
      resumoExtras={`13º de ${money(liquido)}, com ${dividas}% pra dívidas`}
      extras={
        <>
          <CampoRegua
            rotulo="Quitar dívidas / cartão"
            valor={dividas}
            min={0}
            max={100}
            passo={5}
            onChange={mudarDividas}
            formatar={(v) => `${v}%`}
          />
          <CampoDinheiro
            rotulo="13º líquido total"
            valor={liquido}
            min={100_000}
            max={1_000_000}
            passo={10_000}
            onChange={setLiquido}
          />
        </>
      }
      detalhes={
        <div className="flex flex-col gap-2.5">
          <div
            aria-hidden="true"
            className="flex h-4 w-full overflow-hidden rounded-full border border-linha bg-papel-2"
          >
            <div style={{ width: `${dividas}%` }} className="bg-menta transition-all" />
            <div style={{ width: `${janeiro}%` }} className="bg-amarelo transition-all" />
            <div style={{ width: `${festasPct}%` }} className="bg-rosa transition-all" />
          </div>
          <Quadros
            titulo="As fatias"
            itens={[
              { rotulo: 'Dívidas', valor: money(dividasCents), tom: 'bom' },
              { rotulo: 'Janeiro', valor: money(janeiroCents), tom: 'atencao' },
              { rotulo: `Festas (${festasPct}%)`, valor: money(festasCents), tom: 'ruim' },
            ]}
          />
        </div>
      }
    />
  );
}
