'use client';
// m4-l5: O termômetro da paz de espírito, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada. Com contexto, abre com o saldo das contas e o custo do mês da pessoa.
import { useState } from 'react';
import { PresetHint } from '@/components/preset-hint';
import { CampoDinheiro, SimuladorShell, type TomDoResultado } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { termometroPreset, type LessonUserContext } from '@/lib/lesson-context';
import type { SimulatorProps } from './tipos';

/** Os valores de partida e os limites das réguas, em centavos. */
export function entradaDoTermometro(userContext: LessonUserContext | null) {
  const preset = termometroPreset(userContext);
  const guardadoReal = preset ? preset.guardado * 100 : null;
  const custoReal = preset ? preset.custoBasico * 100 : null;
  return {
    temPreset: preset !== null,
    guardadoCents: guardadoReal ?? 360_000,
    custoBasicoCents: custoReal ?? 180_000,
    // A régua cobre os valores reais mesmo fora do intervalo didático.
    maxGuardadoCents: Math.max(2_500_000, guardadoReal ?? 0),
    minCustoCents: Math.min(80_000, custoReal ?? 80_000),
    maxCustoCents: Math.max(600_000, custoReal ?? 600_000),
  };
}

export type FaixaDaPaz = 'critica' | 'inicial' | 'tranquila' | 'plena';

const NIVEIS: Record<FaixaDaPaz, { label: string; tom: TomDoResultado }> = {
  critica: { label: 'Dependência crítica do próximo salário', tom: 'ruim' },
  inicial: { label: 'Colchão inicial (fôlego de curto prazo)', tom: 'atencao' },
  tranquila: { label: 'Zona de tranquilidade (boa autonomia)', tom: 'bom' },
  plena: { label: 'Paz de espírito plena (6+ meses)', tom: 'bom' },
};

export function calcularAutonomia({
  guardadoCents,
  custoBasicoCents,
}: {
  guardadoCents: number;
  custoBasicoCents: number;
}) {
  const mesesAutonomia = guardadoCents / custoBasicoCents;
  const pctBarra = Math.min(100, Math.round((mesesAutonomia / 6) * 100));
  const faixa: FaixaDaPaz =
    mesesAutonomia < 1 ? 'critica' : mesesAutonomia < 3 ? 'inicial' : mesesAutonomia < 6 ? 'tranquila' : 'plena';
  return { mesesAutonomia, pctBarra, faixa, ...NIVEIS[faixa] };
}

export type PalpiteDaPaz = 'menos1' | 'ate3' | 'mais3';

export function palpiteCertoDaPaz(mesesAutonomia: number): PalpiteDaPaz {
  if (mesesAutonomia < 1) return 'menos1';
  return mesesAutonomia < 3 ? 'ate3' : 'mais3';
}

export function TermometroPazDeEspirito({ userContext = null }: SimulatorProps) {
  const entrada = entradaDoTermometro(userContext);
  const [guardado, setGuardado] = useState(entrada.guardadoCents);
  const [custoBasico, setCustoBasico] = useState(entrada.custoBasicoCents);

  const { mesesAutonomia, pctBarra, label, tom } = calcularAutonomia({
    guardadoCents: guardado,
    custoBasicoCents: custoBasico,
  });

  return (
    <SimuladorShell
      pergunta="Se o salário parar hoje, quantos meses você aguenta?"
      aviso={
        entrada.temPreset ? (
          <PresetHint>
            Saldo das suas contas e custo do mês já estão aí. Mexa à vontade pra ver outros cenários.
          </PresetHint>
        ) : undefined
      }
      cenario={[
        { rotulo: 'Saldo guardado hoje', valor: money(guardado) },
        { rotulo: 'Seu custo básico mensal', valor: money(custoBasico) },
      ]}
      palpites={[
        { id: 'menos1', rotulo: 'Menos de 1 mês' },
        { id: 'ate3', rotulo: 'De 1 mês até antes de 3' },
        { id: 'mais3', rotulo: '3 meses ou mais' },
      ]}
      resultado={{
        rotulo: 'Autonomia (Runway)',
        valor: `${mesesAutonomia.toFixed(1).replace('.', ',')} meses`,
        nota: label,
        tom,
        mesesAutonomia,
      }}
      respostaCerta={(r) => palpiteCertoDaPaz(r.mesesAutonomia)}
      explicacao={
        <div className="flex flex-col gap-2">
          <div aria-hidden="true" className="h-3.5 w-full overflow-hidden rounded-full border border-linha bg-cartao">
            <div style={{ width: `${pctBarra}%` }} className="h-full bg-menta transition-all duration-200" />
          </div>
          <p>A barra enche quando o que você guardou cobre 6 meses do seu custo básico.</p>
        </div>
      }
      principal={
        <CampoDinheiro
          rotulo="Saldo guardado hoje"
          valor={guardado}
          min={0}
          max={entrada.maxGuardadoCents}
          passo={20_000}
          onChange={setGuardado}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras="O seu custo básico de um mês"
      extras={
        <CampoDinheiro
          rotulo="Seu custo básico mensal"
          valor={custoBasico}
          min={entrada.minCustoCents}
          max={entrada.maxCustoCents}
          passo={10_000}
          onChange={setCustoBasico}
        />
      }
    />
  );
}
