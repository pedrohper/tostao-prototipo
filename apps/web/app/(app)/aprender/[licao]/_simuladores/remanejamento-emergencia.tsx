'use client';
// m1-l4: Remanejamento de emergência, no SimuladorShell (T6.15). A conta é a de sempre, agora em centavos desde a
// entrada.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoDinheiro, SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

/** O imprevisto da lição. */
export const SUSTO_CENTS = 20_000;

export type CortesDoMes = { deliveryCents: number; roleCents: number; comprasCents: number; uberCents: number };

export function calcularRemanejamento(c: CortesDoMes) {
  const totalCents = c.deliveryCents + c.roleCents + c.comprasCents + c.uberCents;
  return {
    totalCents,
    reequilibrado: totalCents >= SUSTO_CENTS,
    faltaCents: Math.max(0, SUSTO_CENTS - totalCents),
    sobraCents: Math.max(0, totalCents - SUSTO_CENTS),
    progressoPct: Math.min(100, Math.round((totalCents / SUSTO_CENTS) * 100)),
  };
}

export type PalpiteDoSusto = 'falta' | 'certinho' | 'sobra';

export function palpiteCertoDoSusto(totalCents: number): PalpiteDoSusto {
  if (totalCents < SUSTO_CENTS) return 'falta';
  return totalCents === SUSTO_CENTS ? 'certinho' : 'sobra';
}

export function RemanejamentoEmergencia() {
  const [delivery, setDelivery] = useState(6_000);
  const [role, setRole] = useState(7_000);
  const [compras, setCompras] = useState(4_000);
  const [uber, setUber] = useState(3_000);

  const { totalCents, reequilibrado, faltaCents, sobraCents, progressoPct } = calcularRemanejamento({
    deliveryCents: delivery,
    roleCents: role,
    comprasCents: compras,
    uberCents: uber,
  });

  return (
    <SimuladorShell
      pergunta={`Esses cortes dão conta do susto de ${money(SUSTO_CENTS)}?`}
      aviso={
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-rosa p-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-xs font-bold tracking-wider text-vermelho-texto uppercase">Susto inesperado</span>
            <span className="text-sm font-semibold text-tinta">Conserto urgente na oficina / farmácia</span>
          </div>
          <span className="font-display text-lg font-extrabold text-vermelho-texto">{money(SUSTO_CENTS)}</span>
        </div>
      }
      cenario={[
        { rotulo: 'Delivery & lanches', valor: `−${money(delivery)}` },
        { rotulo: 'Rolê do fim de semana', valor: `−${money(role)}` },
        { rotulo: 'Roupas & comprinhas', valor: `−${money(compras)}` },
        { rotulo: 'Uber & caronas pagas', valor: `−${money(uber)}` },
      ]}
      palpites={[
        { id: 'falta', rotulo: 'Não, ainda falta dinheiro' },
        { id: 'certinho', rotulo: 'Sim, na conta certa' },
        { id: 'sobra', rotulo: 'Sim, e ainda sobra' },
      ]}
      resultado={{
        rotulo: reequilibrado ? 'Susto coberto: você remanejou' : 'Ainda faltam',
        valor: money(reequilibrado ? totalCents : faltaCents),
        nota: !reequilibrado
          ? `Você remanejou ${money(totalCents)} de ${money(SUSTO_CENTS)}`
          : sobraCents > 0
            ? `${money(sobraCents)} além do susto`
            : 'A conta fechou certinho',
        tom: reequilibrado ? 'bom' : 'atencao',
        totalCents,
      }}
      respostaCerta={(r) => palpiteCertoDoSusto(r.totalCents)}
      explicacao={
        reequilibrado ? (
          <p>
            <Selo tipo="brilho" />
            <b>Mês reequilibrado!</b> Você cobriu os R$ 200 remanejando gastos flexíveis. O dinheiro saiu das suas
            escolhas conscientes, e você não pagou um real de juros pro rotativo.
          </p>
        ) : (
          <p>
            <Selo tipo="tempo" />
            <b>Ainda faltam {money(faltaCents)}:</b> se não compensar esse valor nas próximas semanas, ele vira fatura
            atrasada ou cheque especial. Aumente o corte em alguma categoria!
          </p>
        )
      }
      principal={
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-tinta-suave">
            Ajuste quanto você vai enxugar nas outras categorias até o fim do mês para cobrir o susto sem pagar juros:
          </p>
          <CampoDinheiro
            rotulo="Delivery & lanches"
            valor={delivery}
            min={0}
            max={12_000}
            passo={1_000}
            onChange={setDelivery}
            dica="Arraste ou toque no número pra digitar."
          />
        </div>
      }
      resumoExtras={`Já cortei ${money(role + compras + uber)} de rolê, roupas e Uber`}
      extras={
        <>
          <CampoDinheiro
            rotulo="Rolê do fim de semana"
            valor={role}
            min={0}
            max={12_000}
            passo={1_000}
            onChange={setRole}
          />
          <CampoDinheiro
            rotulo="Roupas & comprinhas"
            valor={compras}
            min={0}
            max={10_000}
            passo={1_000}
            onChange={setCompras}
          />
          <CampoDinheiro
            rotulo="Uber & caronas pagas"
            valor={uber}
            min={0}
            max={8_000}
            passo={1_000}
            onChange={setUber}
          />
        </>
      }
      detalhes={
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap justify-between gap-x-3 text-[13px] leading-[18px] font-semibold">
            <span>Total remanejado:</span>
            <span className={`font-bold ${reequilibrado ? 'text-verde-texto' : 'text-vermelho-texto'}`}>
              {money(totalCents)} de {money(SUSTO_CENTS)}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-linha bg-papel-2">
            <div
              style={{ width: `${progressoPct}%` }}
              className={`h-full transition-all duration-200 ${reequilibrado ? 'bg-menta' : 'bg-laranja'}`}
            />
          </div>
        </div>
      }
    />
  );
}
