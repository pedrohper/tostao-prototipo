'use client';
// m1-l2: Ajuste das fatias (50/30/20), no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { PresetHint } from '@/components/preset-hint';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { fatiasPreset } from '@/lib/lesson-context';
import type { SimulatorProps } from './tipos';

export type FatiasEntrada = { rendaCents: number; necPct: number; desPct: number };

export function calcularFatias({ rendaCents, necPct, desPct }: FatiasEntrada) {
  const futPct = Math.max(0, 100 - necPct - desPct);
  return {
    futPct,
    necCents: Math.round((rendaCents * necPct) / 100),
    desCents: Math.round((rendaCents * desPct) / 100),
    futCents: Math.round((rendaCents * futPct) / 100),
  };
}

export type Percentuais = { necPct: number; desPct: number };

/** Mexer numa fatia nunca deixa a soma passar de 100%: a outra encolhe. */
export function mudarNecessidades({ desPct }: Percentuais, necPct: number): Percentuais {
  return { necPct, desPct: necPct + desPct > 100 ? 100 - necPct : desPct };
}

export function mudarDesejos({ necPct }: Percentuais, desPct: number): Percentuais {
  return { desPct, necPct: desPct + necPct > 100 ? 100 - desPct : necPct };
}

/** A régua cobre a renda real mesmo fora de R$ 1.200 a 6.000. */
export function reguaDaRenda(rendaDaPessoaCents: number | null) {
  return {
    min: Math.min(120_000, rendaDaPessoaCents ?? 120_000),
    max: Math.max(600_000, rendaDaPessoaCents ?? 600_000),
  };
}

/** Os 20% do futuro na regra 50/30/20. */
export const vintePorCento = (rendaCents: number) => Math.round((rendaCents * 20) / 100);

export type PalpiteDasFatias = 'nada' | 'abaixo' | 'meta';

export function palpiteCertoDasFatias(futCents: number, rendaCents: number): PalpiteDasFatias {
  if (futCents <= 0) return 'nada';
  return futCents < vintePorCento(rendaCents) ? 'abaixo' : 'meta';
}

export function AjusteDasFatias({ userContext = null }: SimulatorProps) {
  const preset = fatiasPreset(userContext);
  const rendaDaPessoa = preset ? preset.renda * 100 : null;
  const [renda, setRenda] = useState(rendaDaPessoa ?? 200_000);
  const [fatias, setFatias] = useState<Percentuais>({ necPct: preset?.nec ?? 55, desPct: preset?.des ?? 30 });
  const { necPct, desPct } = fatias;
  const regua = reguaDaRenda(rendaDaPessoa);
  const { futPct, necCents, desCents, futCents } = calcularFatias({ rendaCents: renda, necPct, desPct });
  const saudavel = necPct <= 65 && futPct >= 15;
  const meta = money(vintePorCento(renda));

  return (
    <SimuladorShell
      pergunta="Quanto da sua renda sobra pro futuro todo mês?"
      aviso={preset && <PresetHint>{preset.hint}</PresetHint>}
      cenario={[
        { rotulo: 'Sua renda mensal líquida', valor: money(renda) },
        { rotulo: 'Necessidades (básico)', valor: `${necPct}%` },
        { rotulo: 'Desejos (lazer, estilo)', valor: `${desPct}%` },
      ]}
      palpites={[
        { id: 'nada', rotulo: 'Nada: o mês leva tudo' },
        { id: 'abaixo', rotulo: `Alguma coisa, menos de ${meta}` },
        { id: 'meta', rotulo: `${meta} ou mais` },
      ]}
      resultado={{
        rotulo: 'Sobra pro futuro por mês',
        valor: money(futCents),
        nota: `Básico ${necPct}% · lazer ${desPct}% · futuro ${futPct}%`,
        tom: futPct === 0 ? 'ruim' : saudavel ? 'bom' : 'atencao',
        futCents,
      }}
      respostaCerta={(r) => palpiteCertoDasFatias(r.futCents, renda)}
      explicacao={
        <div className="flex flex-col gap-2">
          {necPct > 65 && (
            <p>
              <Selo tipo="alerta" />
              <b>Aperto no essencial:</b> quando as necessidades passam de 65%, a margem de manobra diminui. Proteja o
              futuro com ao menos 5% e enxugue os desejos para não entrar no rotativo.
            </p>
          )}
          {futPct === 0 && (
            <p>
              <Selo tipo="perigo" />
              <b>Futuro zerado:</b> o básico e o lazer engoliram 100% da renda. Qualquer imprevisto vai virar dívida no
              cartão. Puxe um pouco dos desejos para abrir espaço para o seu colchão.
            </p>
          )}
          {saudavel && (
            <p>
              <Selo tipo="brilho" />
              <b>Equilíbrio saudável:</b> você cobre o custo de vida, aproveita o momento com lazer e ainda guarda{' '}
              {money(futCents)} todo mês para seu futuro.
            </p>
          )}
          {necPct <= 65 && futPct > 0 && futPct < 15 && (
            <p>
              O básico leva {money(necCents)}, o lazer {money(desCents)} e o futuro fica com <b>{money(futCents)}</b>.
            </p>
          )}
        </div>
      }
      principal={
        <CampoRegua
          rotulo="Desejos (lazer, estilo)"
          valor={desPct}
          min={5}
          max={60}
          passo={1}
          onChange={(v) => setFatias(mudarDesejos(fatias, v))}
          formatar={(v) => `${v}%`}
        />
      }
      resumoExtras={`Renda de ${money(renda)}, com ${necPct}% no básico`}
      extras={
        <>
          <CampoDinheiro
            rotulo="Sua renda mensal líquida"
            valor={renda}
            min={regua.min}
            max={regua.max}
            passo={10_000}
            onChange={setRenda}
            dica="Arraste ou toque no número pra digitar."
          />
          <CampoRegua
            rotulo="Necessidades (básico)"
            valor={necPct}
            min={30}
            max={85}
            passo={1}
            onChange={(v) => setFatias(mudarNecessidades(fatias, v))}
            formatar={(v) => `${v}%`}
          />
        </>
      }
      detalhes={
        <>
          {/* Barra empilhada representando a pizza */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-tinta-suave">Distribuição da sua pizza:</span>
            <div className="flex h-5 w-full overflow-hidden rounded-full border border-linha bg-papel-2">
              <div
                style={{ width: `${necPct}%` }}
                className="bg-amarelo transition-all duration-200"
                title={`Necessidades: ${necPct}%`}
              />
              <div
                style={{ width: `${desPct}%` }}
                className="bg-rosa transition-all duration-200"
                title={`Desejos: ${desPct}%`}
              />
              <div
                style={{ width: `${futPct}%` }}
                className="bg-menta transition-all duration-200"
                title={`Futuro: ${futPct}%`}
              />
            </div>
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 px-1 text-xs font-semibold text-tinta-suave">
              <span className="flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5 rounded-full bg-amarelo" /> Básico {necPct}%
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5 rounded-full bg-rosa" /> Lazer {desPct}%
              </span>
              <span className="flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5 rounded-full bg-menta" /> Futuro {futPct}%
              </span>
            </div>
          </div>
          <Quadros
            itens={[
              { rotulo: 'Básico', valor: money(necCents), tom: 'atencao' },
              { rotulo: 'Lazer', valor: money(desCents), tom: 'ruim' },
              { rotulo: 'Futuro', valor: money(futCents), tom: 'bom' },
            ]}
          />
        </>
      }
    />
  );
}
