'use client';
// m1-l5: Detector de gatilhos, no SimuladorShell (T6.15). A conta é a de sempre.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoLista, Quadros } from '@/components/simulador-campos';
import { CampoRegua, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';
import { palpiteCertoEmValor, palpitesEmVolta, type PalpiteDeValor } from './palpites-lote-a';

export const DIAS_DA_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;

/** R$ 25 de economia por refeição trocada. */
export const ECONOMIA_POR_REFEICAO_CENTS = 2_500;

export type Gatilhos = { dias: string[]; trocas: number };

/** Marca ou desmarca um dia; as trocas nunca ficam acima da quantidade de dias (mas sobra pelo menos 1). */
export function alternarDia({ dias, trocas }: Gatilhos, dia: string): Gatilhos {
  const proximos = dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia];
  return { dias: proximos, trocas: trocas > proximos.length ? Math.max(1, proximos.length) : trocas };
}

export function calcularMarmitas({ diasDeGatilho, trocas }: { diasDeGatilho: number; trocas: number }) {
  const maxTrocas = Math.max(1, diasDeGatilho);
  const diasTrocados = Math.min(trocas, maxTrocas);
  const porSemanaCents = diasTrocados * ECONOMIA_POR_REFEICAO_CENTS;
  return {
    maxTrocas,
    diasTrocados,
    porSemanaCents,
    porMesCents: Math.round(porSemanaCents * 4.33),
    porAnoCents: porSemanaCents * 52,
  };
}

export const palpitesDasMarmitas = (porAnoCents: number, diasDeGatilho: number) =>
  palpitesEmVolta(porAnoCents, diasDeGatilho);

export const palpiteCertoDasMarmitas = (opcoes: readonly PalpiteDeValor[], porAnoCents: number) =>
  palpiteCertoEmValor(opcoes, porAnoCents);

export function DetectorGatilhos() {
  const [gatilhos, setGatilhos] = useState<Gatilhos>({ dias: ['Qui', 'Sex', 'Sáb'], trocas: 2 });
  const { dias, trocas } = gatilhos;
  const { maxTrocas, diasTrocados, porMesCents, porAnoCents } = calcularMarmitas({
    diasDeGatilho: dias.length,
    trocas,
  });
  const opcoes = palpitesDasMarmitas(porAnoCents, dias.length);
  const marcadosNaOrdem = DIAS_DA_SEMANA.filter((d) => dias.includes(d));

  return (
    <SimuladorShell
      pergunta="Trocando delivery por marmita, quanto você guarda em 1 ano?"
      cenario={[
        { rotulo: 'Dias de gatilho na semana', valor: String(dias.length) },
        { rotulo: 'Trocas por marmita na semana', valor: String(diasTrocados) },
        { rotulo: 'Economia por refeição', valor: money(ECONOMIA_POR_REFEICAO_CENTS) },
      ]}
      palpites={opcoes.map((o) => ({ id: o.id, rotulo: `Uns ${money(o.cents)}` }))}
      resultado={{
        rotulo: 'Economia em 1 ano',
        valor: money(porAnoCents),
        nota: `${money(porMesCents)} por mês`,
        tom: 'bom',
        porAnoCents,
      }}
      respostaCerta={(r) => palpiteCertoDasMarmitas(opcoes, r.porAnoCents)}
      explicacao={
        <p>
          <Selo tipo="meta" />
          <b>A regra não é sofrer:</b> você não precisa cozinhar os 7 dias da semana. Trocar apenas{' '}
          <b>
            {diasTrocados} {diasTrocados > 1 ? 'refeições' : 'refeição'}
          </b>{' '}
          por comida congelada ou simples já injeta <b>{money(porAnoCents)}</b> na sua reserva anual.
        </p>
      }
      principal={
        <div className="flex flex-col gap-1.5">
          <CampoRegua
            rotulo="Trocar por marmita / comida em casa"
            valor={diasTrocados}
            min={1}
            max={maxTrocas}
            passo={1}
            onChange={(v) => setGatilhos({ dias, trocas: v })}
            formatar={(v) => `${v} dia${v > 1 ? 's' : ''}/semana`}
          />
          <span className="text-[13px] leading-snug text-tinta-suave">
            Economia estimada de {money(ECONOMIA_POR_REFEICAO_CENTS)} por refeição preparada em casa.
          </span>
        </div>
      }
      resumoExtras={
        marcadosNaOrdem.length ? `Dias de gatilho: ${marcadosNaOrdem.join(', ')}` : 'Nenhum dia de gatilho marcado'
      }
      extras={
        <CampoLista
          rotulo="Quais dias você mais pede delivery ou come na rua por cansaço?"
          itens={DIAS_DA_SEMANA.map((d) => ({ id: d, rotulo: d }))}
          marcados={dias}
          onAlternar={(d) => setGatilhos(alternarDia(gatilhos, d))}
          formato="chips"
        />
      }
      detalhes={<Quadros itens={[{ rotulo: 'Economia no mês', valor: money(porMesCents), tom: 'atencao' }]} />}
    />
  );
}
