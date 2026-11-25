'use client';
// m6-l2: Saque-aniversário vs. rescisão, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { Quadros } from '@/components/simulador-campos';
import { CampoDinheiro, CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { valorQueCabe } from './apoio-m6-m8';

export function calcularSaqueAniversario({ brutoCents, anos }: { brutoCents: number; anos: number }) {
  const depositoMensalCents = Math.round(brutoCents * 0.08);
  const saldoFgtsCents = depositoMensalCents * 12 * anos;
  const multa40Cents = Math.round(saldoFgtsCents * 0.4);
  const saqueRescisaoCents = saldoFgtsCents + multa40Cents;
  const saqueAniversarioCents = multa40Cents;
  const travadoCents = saldoFgtsCents;
  return {
    depositoMensalCents,
    saldoFgtsCents,
    multa40Cents,
    saqueRescisaoCents,
    saqueAniversarioCents,
    travadoCents,
  };
}

export type PalpiteDoSaque = 'multa' | 'tudo' | 'saldo';

/** Compara o que sai na demissão com os três palpites: tudo (saldo + multa), só o saldo ou só a multa. */
export function palpiteCertoDoSaque(r: {
  saqueAniversarioCents: number;
  saqueRescisaoCents: number;
  travadoCents: number;
}): PalpiteDoSaque {
  if (r.saqueAniversarioCents >= r.saqueRescisaoCents) return 'tudo';
  return r.saqueAniversarioCents === r.travadoCents ? 'saldo' : 'multa';
}

const tempo = (anos: number) => `${anos} ano${anos > 1 ? 's' : ''}`;

export function SaqueAniversarioVsRescisao() {
  const [bruto, setBruto] = useState(300_000);
  const [anos, setAnos] = useState(3);

  const conta = calcularSaqueAniversario({ brutoCents: bruto, anos });
  const { depositoMensalCents, saldoFgtsCents, multa40Cents, saqueRescisaoCents } = conta;
  const { saqueAniversarioCents, travadoCents } = conta;

  return (
    <SimuladorShell
      pergunta="Demissão sem justa causa: quanto você saca estando no saque-aniversário?"
      cenario={[
        { rotulo: 'Salário bruto', valor: money(bruto) },
        { rotulo: 'Tempo de empresa', valor: tempo(anos) },
        { rotulo: 'FGTS por mês (8%)', valor: money(depositoMensalCents) },
        { rotulo: 'Saldo acumulado', valor: money(saldoFgtsCents) },
        { rotulo: 'Multa de 40%', valor: money(multa40Cents) },
      ]}
      palpites={[
        { id: 'multa', rotulo: `Só a multa: ${money(multa40Cents)}` },
        { id: 'tudo', rotulo: `Tudo: ${money(saqueRescisaoCents)}` },
        { id: 'saldo', rotulo: `Só o saldo: ${money(saldoFgtsCents)}` },
      ]}
      resultado={{
        rotulo: 'No saque-aniversário, você saca',
        valor: valorQueCabe(money(saqueAniversarioCents), 'de multa'),
        nota: `Só a multa. ${money(travadoCents)} do saldo ficam retidos`,
        tom: 'ruim',
        saqueAniversarioCents,
        saqueRescisaoCents,
        travadoCents,
      }}
      respostaCerta={palpiteCertoDoSaque}
      explicacao={
        <div className="flex flex-col gap-2">
          <p>
            <Selo tipo="alerta" />
            No Saque-Aniversário, <b>{money(travadoCents)}</b> do seu saldo ficam retidos se você for demitido sem justa
            causa — e voltar para o Saque-Rescisão leva 25 meses.
          </p>
          <p className="text-[13px] leading-[18px] text-tinta-suave">
            Saldo acumulado de FGTS (8%/mês): <b className="text-tinta">{money(saldoFgtsCents)}</b> + Multa de 40%:{' '}
            <b className="text-tinta">{money(multa40Cents)}</b>.
          </p>
        </div>
      }
      principal={
        <CampoDinheiro
          rotulo="Salário bruto"
          valor={bruto}
          min={150_000}
          max={1_200_000}
          passo={10_000}
          onChange={setBruto}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`${tempo(anos)} de empresa`}
      extras={
        <CampoRegua
          rotulo="Tempo de empresa"
          valor={anos}
          min={1}
          max={5}
          passo={1}
          onChange={setAnos}
          formatar={tempo}
        />
      }
      detalhes={
        <Quadros
          titulo="Na demissão"
          itens={[
            {
              rotulo: 'Saque-Rescisão',
              valor: money(saqueRescisaoCents),
              tom: 'bom',
              nota: 'Saldo + multa de 40%',
            },
            {
              rotulo: 'Saque-Aniversário',
              valor: money(saqueAniversarioCents),
              tom: 'ruim',
              nota: 'Só a multa na demissão',
            },
            { rotulo: 'Fica retido', valor: money(travadoCents), nota: 'O saldo, no Saque-Aniversário' },
          ]}
        />
      }
    />
  );
}
