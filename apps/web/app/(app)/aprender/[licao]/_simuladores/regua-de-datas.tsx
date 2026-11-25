'use client';
// m2-l5: Régua de datas, no SimuladorShell (T6.15). A conta é a de sempre (mês de 30 dias).
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoRegua, SimuladorShell } from '@/components/simulador-shell';

export type DatasEntrada = { fechamento: number; vencimento: number; compra: number };

export function calcularReguaDeDatas({ fechamento, vencimento, compra }: DatasEntrada) {
  const caiNaProxima = compra >= fechamento;
  const entreFechamentoEVencimento = vencimento >= fechamento ? vencimento - fechamento : 30 - fechamento + vencimento;
  const diasDeFolego = caiNaProxima
    ? 30 - compra + fechamento + entreFechamentoEVencimento
    : fechamento - compra + entreFechamentoEVencimento;
  return { caiNaProxima, diasDeFolego };
}

export type PalpiteDasDatas = 'curto' | 'medio' | 'longo';

/** Menos de 2 semanas, de 14 a 30 dias, ou mais de 30. */
export function palpiteCertoDasDatas(diasDeFolego: number): PalpiteDasDatas {
  if (diasDeFolego < 14) return 'curto';
  return diasDeFolego <= 30 ? 'medio' : 'longo';
}

const dia = (n: number) => `Dia ${n}`;

export function ReguaDeDatas() {
  const [fechamento, setFechamento] = useState(10);
  const [vencimento, setVencimento] = useState(17);
  const [compra, setCompra] = useState(11);

  const { caiNaProxima, diasDeFolego } = calcularReguaDeDatas({ fechamento, vencimento, compra });
  const prazo = `${diasDeFolego} ${diasDeFolego === 1 ? 'dia' : 'dias'}`;

  return (
    <SimuladorShell
      pergunta="Comprando nesse dia, quanto tempo até pagar?"
      cenario={[
        { rotulo: 'A fatura fecha', valor: dia(fechamento) },
        { rotulo: 'A fatura vence', valor: dia(vencimento) },
        { rotulo: 'Dia da compra', valor: dia(compra) },
      ]}
      palpites={[
        { id: 'curto', rotulo: 'Menos de 2 semanas' },
        { id: 'medio', rotulo: 'De 14 a 30 dias' },
        { id: 'longo', rotulo: 'Mais de 30 dias' },
      ]}
      resultado={{
        rotulo: 'Fôlego até pagar',
        valor: prazo,
        nota: caiNaProxima ? 'Cai na próxima fatura' : 'Cai na fatura atual',
        tom: caiNaProxima ? 'bom' : 'atencao',
        diasDeFolego,
      }}
      respostaCerta={(r) => palpiteCertoDasDatas(r.diasDeFolego)}
      explicacao={
        caiNaProxima ? (
          <p>
            <Selo tipo="meta" />
            <b>Melhor janela de compra:</b> comprando a partir do dia {fechamento} (fechamento), você ganha{' '}
            <b>{prazo}</b> de fôlego antes do vencimento no dia {vencimento} do próximo ciclo.
          </p>
        ) : (
          <p>
            <Selo tipo="tempo" />
            <b>Cai nesta fatura:</b> como você comprou antes do fechamento (dia {fechamento}), a cobrança já vem no
            vencimento próximo (dia {vencimento}), em apenas <b>{prazo}</b>.
          </p>
        )
      }
      principal={
        <CampoRegua
          rotulo="Dia da compra no mês"
          valor={compra}
          min={1}
          max={30}
          passo={1}
          onChange={setCompra}
          formatar={dia}
        />
      }
      resumoExtras={`Fecha no dia ${fechamento} e vence no dia ${vencimento}`}
      extras={
        <>
          <CampoRegua
            rotulo="Fechamento"
            valor={fechamento}
            min={1}
            max={28}
            passo={1}
            onChange={setFechamento}
            formatar={dia}
          />
          <CampoRegua
            rotulo="Vencimento"
            valor={vencimento}
            min={1}
            max={28}
            passo={1}
            onChange={setVencimento}
            formatar={dia}
          />
        </>
      }
    />
  );
}
