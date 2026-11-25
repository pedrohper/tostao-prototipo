'use client';
// m5-l3: O balanço do estágio, no SimuladorShell (T6.13). A conta é a de sempre, agora em centavos desde a entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type EstagioEntrada = {
  bolsaCents: number;
  mensalidadeCents: number;
  transporteCents: number;
  alimentacaoCents: number;
};

export function calcularBalancoDoEstagio(e: EstagioEntrada) {
  const liquidoCents = e.bolsaCents - e.mensalidadeCents - e.transporteCents - e.alimentacaoCents;
  return { liquidoCents, positivo: liquidoCents >= 0 };
}

export function BalancoDoEstagio() {
  const [bolsa, setBolsa] = useState(120_000);
  const [mensalidade, setMensalidade] = useState(45_000);
  const [transporte, setTransporte] = useState(22_000);
  const [alimentacao, setAlimentacao] = useState(28_000);

  const { liquidoCents, positivo } = calcularBalancoDoEstagio({
    bolsaCents: bolsa,
    mensalidadeCents: mensalidade,
    transporteCents: transporte,
    alimentacaoCents: alimentacao,
  });
  const faltaCents = Math.abs(liquidoCents);

  return (
    <SimuladorShell
      pergunta="Esse estágio se paga?"
      cenario={[
        { rotulo: 'Bolsa-auxílio', valor: `+${money(bolsa)}` },
        { rotulo: 'Mensalidade do curso', valor: `−${money(mensalidade)}` },
        { rotulo: 'Transporte', valor: `−${money(transporte)}` },
        { rotulo: 'Comida na rua', valor: `−${money(alimentacao)}` },
      ]}
      palpites={[
        { id: 'paga', rotulo: 'Sim, se paga' },
        { id: 'falta', rotulo: 'Não, falta dinheiro' },
      ]}
      resultado={{
        rotulo: positivo ? 'Sobra por mês' : 'Falta por mês',
        valor: money(faltaCents),
        nota: positivo ? `${money(liquidoCents * 12)} em um ano` : `${money(faltaCents * 12)} do seu bolso em um ano`,
        tom: positivo ? 'bom' : 'ruim',
        positivo,
      }}
      respostaCerta={(r) => (r.positivo ? 'paga' : 'falta')}
      explicacao={
        positivo ? (
          <p>
            <Selo tipo="ok" />
            <b>Saldo positivo:</b> além da experiência no currículo, sobram <b>{money(liquidoCents)}</b> limpos por mês
            ({money(liquidoCents * 12)}/ano).
          </p>
        ) : (
          <p>
            <Selo tipo="alerta" />
            <b>Você está pagando para estagiar:</b> faltam {money(faltaCents)}/mês. Só vale se houver chance real de
            efetivação rápida ou auxílio-transporte/refeição.
          </p>
        )
      }
      principal={
        <CampoDinheiro
          rotulo="Bolsa-auxílio por mês"
          valor={bolsa}
          min={50_000}
          max={300_000}
          passo={5_000}
          onChange={setBolsa}
          dica="Arraste ou toque no número pra digitar."
        />
      }
      resumoExtras={`Já descontei ${money(mensalidade + transporte + alimentacao)} de curso, transporte e comida`}
      extras={
        <>
          <CampoDinheiro
            rotulo="Mensalidade do curso"
            valor={mensalidade}
            min={0}
            max={150_000}
            passo={5_000}
            onChange={setMensalidade}
          />
          <CampoDinheiro
            rotulo="Transporte"
            valor={transporte}
            min={0}
            max={50_000}
            passo={2_000}
            onChange={setTransporte}
          />
          <CampoDinheiro
            rotulo="Comida na rua"
            valor={alimentacao}
            min={0}
            max={80_000}
            passo={2_000}
            onChange={setAlimentacao}
          />
        </>
      }
    />
  );
}
