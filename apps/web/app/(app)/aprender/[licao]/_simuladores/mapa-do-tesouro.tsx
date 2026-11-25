'use client';
// m7-l4: O mapa do Tesouro, no SimuladorShell (T6.15). A projeção é a de sempre, agora com a base em centavos.
import { useState } from 'react';
import { CampoOpcoes, Quadros } from '@/components/simulador-campos';
import { SimuladorShell, type TomDoResultado } from '@/components/simulador-shell';
import { money } from '@/lib/format';

export type ObjetivoDoTesouro = 'curto' | 'medio' | 'longo';

export const BASE_DO_TESOURO_CENTS = 100_000;

type Titulo = {
  titulo: string;
  prazo: string;
  uso: string;
  taxa: string;
  anos: number;
  retornoEstimado: number;
  tom: TomDoResultado;
  motivo: string;
};

const MAPA: Record<ObjetivoDoTesouro, Titulo> = {
  curto: {
    titulo: 'Tesouro Selic',
    prazo: '1 ano',
    uso: 'Reserva de emergência',
    taxa: 'Selic (~11,25% a.a.)',
    anos: 1,
    retornoEstimado: 0.1125,
    tom: 'bom',
    motivo:
      'Rende todo dia útil e não sofre perda se você precisar sacar antes. É o único título indicado para reserva de emergência.',
  },
  medio: {
    titulo: 'Tesouro Prefixado',
    prazo: '3 anos',
    uso: 'Meta com data marcada',
    taxa: 'Taxa travada (~12,0% a.a.)',
    anos: 3,
    retornoEstimado: 0.12,
    tom: 'atencao',
    motivo:
      'Você sabe exatamente quanto vai receber no vencimento. Mas cuidado: se vender antes do prazo, o preço oscila (marcação a mercado).',
  },
  longo: {
    titulo: 'Tesouro IPCA+',
    prazo: '10 anos',
    uso: 'Aposentadoria e longo prazo',
    taxa: 'Inflação + ~6,2% a.a.',
    anos: 10,
    retornoEstimado: 0.107,
    tom: 'bom',
    motivo: 'Garante que seu dinheiro sempre ganhe da inflação, protegendo seu poder de compra por décadas.',
  },
};

export function projetarTesouro({
  objetivo,
  baseCents = BASE_DO_TESOURO_CENTS,
}: {
  objetivo: ObjetivoDoTesouro;
  baseCents?: number;
}) {
  const titulo = MAPA[objetivo];
  const base = baseCents / 100;
  const projecaoCents = Math.round(base * Math.pow(1 + titulo.retornoEstimado, titulo.anos) * 100);
  return { ...titulo, projecaoCents };
}

export type PalpiteDoTesouro = 'prefixado' | 'ipca' | 'selic';

export function palpiteCertoDoTesouro(objetivo: ObjetivoDoTesouro): PalpiteDoTesouro {
  if (objetivo === 'curto') return 'selic';
  return objetivo === 'medio' ? 'prefixado' : 'ipca';
}

export function MapaDoTesouro() {
  const [objetivo, setObjetivo] = useState<ObjetivoDoTesouro>('curto');
  const t = projetarTesouro({ objetivo });

  return (
    <SimuladorShell
      pergunta="Qual título do Tesouro combina com essa grana?"
      cenario={[
        { rotulo: 'Pra quê', valor: objetivo === 'longo' ? 'Aposentadoria' : t.uso },
        { rotulo: 'Prazo', valor: t.prazo },
      ]}
      palpites={[
        { id: 'selic', rotulo: 'Tesouro Selic' },
        { id: 'prefixado', rotulo: 'Tesouro Prefixado' },
        { id: 'ipca', rotulo: 'Tesouro IPCA+' },
      ]}
      resultado={{
        rotulo: 'O título que combina',
        valor: t.titulo,
        nota: `${t.prazo} / ${t.uso}`,
        tom: t.tom,
        objetivo,
      }}
      respostaCerta={(r) => palpiteCertoDoTesouro(r.objetivo)}
      explicacao={
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">{t.taxa}</p>
          <p>{t.motivo}</p>
        </div>
      }
      principal={
        <CampoOpcoes<ObjetivoDoTesouro>
          rotulo="Pra quando é o dinheiro"
          opcoes={[
            { id: 'curto', rotulo: '1 ano (Reserva)' },
            { id: 'medio', rotulo: '3 anos (Meta)' },
            { id: 'longo', rotulo: '10 anos (Futuro)' },
          ]}
          valor={objetivo}
          onChange={setObjetivo}
          empilhado
        />
      }
      detalhes={
        <Quadros
          itens={[
            {
              rotulo: `Projeção bruta de ${money(BASE_DO_TESOURO_CENTS)} em ${t.anos} ano${t.anos > 1 ? 's' : ''}`,
              valor: money(t.projecaoCents),
            },
          ]}
        />
      }
    />
  );
}
