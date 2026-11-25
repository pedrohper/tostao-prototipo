'use client';
// m4-l1: Calculadora do custo básico, no SimuladorShell (T6.15). A soma é a de sempre (já era em centavos).
import { useState } from 'react';
import { CampoLista, Quadros } from '@/components/simulador-campos';
import { SimuladorShell } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export const ITENS_DO_CUSTO_BASICO = [
  { id: 'moradia', label: 'Aluguel / Moradia', valorCents: 90000, superfluo: false },
  { id: 'mercado', label: 'Mercado básico', valorCents: 60000, superfluo: false },
  { id: 'transporte', label: 'Transporte', valorCents: 25000, superfluo: false },
  { id: 'contas', label: 'Luz, água e internet', valorCents: 25000, superfluo: false },
  { id: 'delivery', label: 'Delivery & lanches', valorCents: 30000, superfluo: true },
  { id: 'roles', label: 'Rolês & streaming', valorCents: 25000, superfluo: true },
] as const;

export function calcularCustoBasico(marcados: readonly string[]) {
  const mensalCents = ITENS_DO_CUSTO_BASICO.reduce(
    (acc, it) => acc + (marcados.includes(it.id) ? it.valorCents : 0),
    0,
  );
  return { mensalCents, tresMesesCents: mensalCents * 3, seisMesesCents: mensalCents * 6 };
}

export type PalpiteDoCustoBasico = 'pouco' | 'meio' | 'muito';

const ESSENCIAL_CENTS = ITENS_DO_CUSTO_BASICO.reduce((acc, it) => acc + (it.superfluo ? 0 : it.valorCents), 0);

/** As faixas do palpite saem dos itens essenciais da lista: 2 e 3 meses só deles. */
export const FAIXAS_DO_MURO = { baixoCents: ESSENCIAL_CENTS * 2, altoCents: ESSENCIAL_CENTS * 3 };

export function palpiteCertoDoCustoBasico(tresMesesCents: number): PalpiteDoCustoBasico {
  if (tresMesesCents < FAIXAS_DO_MURO.baixoCents) return 'pouco';
  return tresMesesCents <= FAIXAS_DO_MURO.altoCents ? 'meio' : 'muito';
}

export function CalculadoraCustoBasico() {
  const [marcados, setMarcados] = useState<string[]>(() => ITENS_DO_CUSTO_BASICO.map((it) => it.id));

  const alternar = (id: string) =>
    setMarcados((atuais) => (atuais.includes(id) ? atuais.filter((m) => m !== id) : [...atuais, id]));

  const { mensalCents, tresMesesCents, seisMesesCents } = calcularCustoBasico(marcados);
  const baixo = money(FAIXAS_DO_MURO.baixoCents);
  const alto = money(FAIXAS_DO_MURO.altoCents);

  return (
    <SimuladorShell
      pergunta="De quantos reais é feito o seu muro de 3 meses?"
      cenario={ITENS_DO_CUSTO_BASICO.filter((it) => marcados.includes(it.id)).map((it) => ({
        rotulo: `${it.label} (por mês)`,
        valor: money(it.valorCents),
      }))}
      palpites={[
        { id: 'pouco', rotulo: `Menos de ${baixo}` },
        { id: 'meio', rotulo: `De ${baixo} a ${alto}` },
        { id: 'muito', rotulo: `Mais de ${alto}` },
      ]}
      resultado={{
        rotulo: 'Muro de 3 meses',
        valor: money(tresMesesCents),
        nota: `1 mês do seu custo básico: ${money(mensalCents)}`,
        tom: 'bom',
        tresMesesCents,
      }}
      respostaCerta={(r) => palpiteCertoDoCustoBasico(r.tresMesesCents)}
      explicacao={
        <p>
          O muro é o custo de <b>1 mês</b> vezes os meses que você quer aguentar. Cada supérfluo que sai da lista deixa
          o muro menor.
        </p>
      }
      principal={
        <CampoLista
          rotulo="Desmarque os supérfluos que você cortaria num mês de aperto para achar seu custo básico real"
          itens={ITENS_DO_CUSTO_BASICO.map((it) => ({ id: it.id, rotulo: it.label, valor: money(it.valorCents) }))}
          marcados={marcados}
          onAlternar={alternar}
        />
      }
      detalhes={
        <Quadros
          titulo="O seu muro"
          itens={[
            { rotulo: '1 mês', valor: money(mensalCents), tom: 'atencao' },
            { rotulo: '3 meses', valor: money(tresMesesCents) },
            { rotulo: '6 meses', valor: money(seisMesesCents), tom: 'bom' },
          ]}
        />
      }
    />
  );
}
