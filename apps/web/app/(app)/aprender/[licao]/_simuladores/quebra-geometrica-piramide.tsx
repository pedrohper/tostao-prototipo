'use client';
// m9-l3: A quebra geométrica da pirâmide, no SimuladorShell (T6.15). A conta é a de sempre.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoOpcoes, Quadros } from '@/components/simulador-campos';
import { CampoRegua, SimuladorShell } from '@/components/simulador-shell';

const BRASIL = 212_000_000;
const TERRA = 8_000_000_000;

export function calcularPiramide(recrutas: number, niveis: number) {
  const noNivel = Math.pow(recrutas, niveis);
  const totalAcumulado = (Math.pow(recrutas, niveis + 1) - 1) / (recrutas - 1);
  return { noNivel, totalAcumulado, passouBrasil: totalAcumulado > BRASIL, passouTerra: totalAcumulado > TERRA };
}

export type PalpiteDaPiramide = 'centenas' | 'milhares' | 'muito';

/** As faixas do palpite partem da conta "em linha reta" (pessoas por nível × níveis): 10 e 1.000 vezes ela. */
export const faixasDaPiramide = (recrutas: number, niveis: number) => ({
  baixo: recrutas * niveis * 10,
  alto: recrutas * niveis * 1000,
});

export function palpiteCertoDaPiramide(recrutas: number, niveis: number, total: number): PalpiteDaPiramide {
  const { baixo, alto } = faixasDaPiramide(recrutas, niveis);
  if (total <= baixo) return 'centenas';
  return total <= alto ? 'milhares' : 'muito';
}

const numero = (n: number) => n.toLocaleString('pt-BR');

export function QuebraGeometricaPiramide() {
  const [recrutas, setRecrutas] = useState(3);
  const [niveis, setNiveis] = useState(10);

  const { noNivel, totalAcumulado, passouBrasil, passouTerra } = calcularPiramide(recrutas, niveis);
  const faixas = faixasDaPiramide(recrutas, niveis);

  return (
    <SimuladorShell
      pergunta="Quantas pessoas a pirâmide precisa pra chegar nesse nível?"
      cenario={[
        { rotulo: 'No topo (nível 0)', valor: '1 pessoa' },
        { rotulo: 'Cada membro precisa recrutar', valor: `${recrutas} pessoas` },
        { rotulo: 'A pirâmide chega ao', valor: `nível ${niveis}` },
      ]}
      palpites={[
        { id: 'centenas', rotulo: `Até ${numero(faixas.baixo)} pessoas` },
        { id: 'milhares', rotulo: `Entre ${numero(faixas.baixo)} e ${numero(faixas.alto)}` },
        { id: 'muito', rotulo: `Mais de ${numero(faixas.alto)}` },
      ]}
      resultado={{
        rotulo: 'Total acumulado',
        // Com a palavra junto, números de 12 dígitos passam pra letra menor do shell e cabem em 320 px.
        valor: `${numero(totalAcumulado)} pessoas`,
        nota: `do topo até o nível ${niveis}`,
        tom: passouBrasil ? 'ruim' : 'atencao',
        totalAcumulado,
      }}
      respostaCerta={(r) => palpiteCertoDaPiramide(recrutas, niveis, r.totalAcumulado)}
      explicacao={
        <p>
          <Selo tipo={passouTerra || passouBrasil ? 'perigo' : 'alta'} />
          {passouTerra
            ? 'Estourou a população da Terra (8 bilhões)! Não existe mais ninguém no planeta para recrutar.'
            : passouBrasil
              ? 'Já passou de toda a população do Brasil (212 milhões). A base sempre fica sem ter quem recrutar e perde dinheiro.'
              : 'Suba mais alguns níveis para ver como a progressão geométrica esgota rapidamente a população inteira.'}
        </p>
      }
      principal={
        <CampoRegua
          rotulo="Nível da pirâmide"
          valor={niveis}
          min={1}
          max={16}
          passo={1}
          onChange={setNiveis}
          formatar={(v) => `Nível ${v}`}
        />
      }
      resumoExtras={`Cada membro recrutando ${recrutas} pessoas`}
      extras={
        <CampoOpcoes
          rotulo="Quantas pessoas cada membro precisa recrutar"
          opcoes={[2, 3, 5].map((k) => ({ id: k, rotulo: `${k} pessoas` }))}
          valor={recrutas}
          onChange={setRecrutas}
        />
      }
      detalhes={<Quadros itens={[{ rotulo: `Só no nível ${niveis}`, valor: numero(noNivel), tom: 'atencao' }]} />}
    />
  );
}
