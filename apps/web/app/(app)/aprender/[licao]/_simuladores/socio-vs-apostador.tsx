'use client';
// m8-l1: Sócio vs. apostador, no SimuladorShell (T6.15). Os números são os de sempre.
import { useState } from 'react';
import { CampoOpcoes } from '@/components/simulador-campos';
import { SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type ModoDoSocio = 'dia' | 'anos';

/** De onde as duas séries partem: R$ 1.000,00. */
export const INICIO_DO_SOCIO_CENTS = 100_000;

const DIAS = [
  { label: 'Seg', varPct: -4.1, valorCents: 95900 },
  { label: 'Ter', varPct: +2.8, valorCents: 98585 },
  { label: 'Qua', varPct: -3.5, valorCents: 95134 },
  { label: 'Qui', varPct: +1.4, valorCents: 96466 },
  { label: 'Sex', varPct: -2.2, valorCents: 94344 },
] as const;

const ANOS = [
  { label: 'Ano 1', varPct: +12, valorCents: 112000 },
  { label: 'Ano 2', varPct: +14, valorCents: 127680 },
  { label: 'Ano 3', varPct: +11, valorCents: 141725 },
  { label: 'Ano 4', varPct: +15, valorCents: 162984 },
  { label: 'Ano 5', varPct: +13, valorCents: 184171 },
] as const;

export function resumirPeriodo(modo: ModoDoSocio) {
  const itens: readonly { label: string; varPct: number; valorCents: number }[] = modo === 'dia' ? DIAS : ANOS;
  const finalCents = itens[itens.length - 1]!.valorCents;
  const altas = itens.filter((i) => i.varPct >= 0).length;
  return {
    itens,
    finalCents,
    diferencaCents: finalCents - INICIO_DO_SOCIO_CENTS,
    altas,
    quedas: itens.length - altas,
  };
}

export type PalpiteDoSocio = 'perdeu-muito' | 'perdeu-pouco' | 'ganhou';

/** Fronteira do tombo grande: terminar abaixo de 90% do começo. */
export const PISO_DO_TOMBO_PEQUENO_CENTS = 90_000;

export function palpiteCertoDoSocio(finalCents: number): PalpiteDoSocio {
  if (finalCents >= INICIO_DO_SOCIO_CENTS) return 'ganhou';
  return finalCents >= PISO_DO_TOMBO_PEQUENO_CENTS ? 'perdeu-pouco' : 'perdeu-muito';
}

const variacao = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;

export function SocioVsApostador() {
  const [modo, setModo] = useState<ModoDoSocio>('dia');
  const { itens, finalCents, diferencaCents, altas, quedas } = resumirPeriodo(modo);
  const dia = modo === 'dia';
  const inicio = money(INICIO_DO_SOCIO_CENTS);

  return (
    <SimuladorShell
      pergunta="Essa ação sobe e desce. No fim do período, como ficou o seu dinheiro?"
      cenario={[
        { rotulo: 'Valor no começo', valor: inicio },
        { rotulo: 'Período', valor: dia ? '5 dias' : '5 anos' },
        { rotulo: dia ? 'Dias de alta' : 'Anos de alta', valor: String(altas) },
        { rotulo: dia ? 'Dias de queda' : 'Anos de queda', valor: String(quedas) },
        { rotulo: dia ? 'Primeiro dia' : 'Primeiro ano', valor: variacao(itens[0]!.varPct) },
      ]}
      palpites={[
        { id: 'perdeu-muito', rotulo: `Menos de ${money(PISO_DO_TOMBO_PEQUENO_CENTS)}` },
        { id: 'perdeu-pouco', rotulo: `Entre ${money(PISO_DO_TOMBO_PEQUENO_CENTS)} e ${inicio}` },
        { id: 'ganhou', rotulo: `${inicio} ou mais` },
      ]}
      resultado={{
        rotulo: dia ? `Na sexta, ${inicio} viraram` : `No ano 5, ${inicio} viraram`,
        valor: money(finalCents),
        nota: `${diferencaCents >= 0 ? '+' : '−'}${money(Math.abs(diferencaCents))} no período`,
        tom: diferencaCents >= 0 ? 'bom' : 'ruim',
        finalCents,
      }}
      respostaCerta={(r) => palpiteCertoDoSocio(r.finalCents)}
      explicacao={
        <p>
          {dia
            ? 'No curto prazo, o preço oscila por humor e notícia. Quem olha todo dia tende a vender na baixa por pânico.'
            : 'No longo prazo, o preço segue o lucro real da empresa. Quem pensa como sócio atravessa o ruído.'}
        </p>
      }
      principal={
        <CampoOpcoes<ModoDoSocio>
          rotulo="Como você acompanha"
          opcoes={[
            { id: 'dia', rotulo: 'Olhar todo dia' },
            { id: 'anos', rotulo: 'Olhar em 5 anos' },
          ]}
          valor={modo}
          onChange={setModo}
        />
      }
      detalhes={
        <section className="flex flex-col gap-2" aria-label={dia ? 'Dia a dia' : 'Ano a ano'}>
          <h3 className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
            {dia ? 'Dia a dia' : 'Ano a ano'}
          </h3>
          <ul className="flex flex-col divide-y divide-linha rounded-2xl border border-linha">
            {itens.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] leading-[18px] tabular-nums"
              >
                <span className="font-bold">{item.label}</span>
                <span className={`font-bold ${item.varPct >= 0 ? 'text-verde-texto' : 'text-vermelho-texto'}`}>
                  {variacao(item.varPct)}
                </span>
                <span className="font-display text-[15px] font-extrabold">{money(item.valorCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      }
    />
  );
}
