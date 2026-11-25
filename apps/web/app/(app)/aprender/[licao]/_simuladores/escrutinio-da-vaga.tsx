'use client';
// m9-l4: O escrutínio da vaga, no SimuladorShell (T6.15). A pontuação é a de sempre.
import { useState } from 'react';
import { CampoLista } from '@/components/simulador-campos';
import { SimuladorShell, type TomDoResultado } from '@/components/simulador-shell';

export const SINAIS_DA_VAGA = [
  { id: 'taxa', rotulo: 'Pede taxa, kit ou curso pago para começar' },
  { id: 'contato', rotulo: 'Usa e-mail gratuito (@gmail) ou só WhatsApp' },
  { id: 'salario', rotulo: 'Promete salário irreal sem entrevista' },
  { id: 'documentos', rotulo: 'Pede foto de RG/CPF ou selfie no WhatsApp' },
  { id: 'urgencia', rotulo: 'Pressão de urgência ("fecha em 30 min")' },
] as const;

export type RiscoDaVaga = 'sem' | 'moderado' | 'alto';

const NIVEIS: Record<RiscoDaVaga, { label: string; tom: TomDoResultado }> = {
  sem: { label: 'Sem sinais de alerta', tom: 'bom' },
  moderado: { label: 'Risco moderado — investigue', tom: 'atencao' },
  alto: { label: 'Alto risco de golpe! Fuja', tom: 'ruim' },
};

export function avaliarVaga(marcados: readonly string[]) {
  const score = marcados.length;
  const risco: RiscoDaVaga = score === 0 ? 'sem' : score <= 2 ? 'moderado' : 'alto';
  return { score, risco, ...NIVEIS[risco] };
}

export type PalpiteDaVaga = RiscoDaVaga;

export const palpiteCertoDaVaga = (risco: RiscoDaVaga): PalpiteDaVaga => risco;

export function EscrutinioDaVaga() {
  const [marcados, setMarcados] = useState<string[]>(['taxa', 'documentos']);

  const alternar = (id: string) =>
    setMarcados((atuais) => (atuais.includes(id) ? atuais.filter((m) => m !== id) : [...atuais, id]));

  const { score, risco, label, tom } = avaliarVaga(marcados);
  const total = SINAIS_DA_VAGA.length;
  const fora = total - score;

  return (
    <SimuladorShell
      pergunta="Qual é o risco de essa vaga ser golpe?"
      cenario={[
        ...SINAIS_DA_VAGA.filter((s) => marcados.includes(s.id)).map((s) => ({ rotulo: s.rotulo, valor: 'tem' })),
        ...(fora > 0 ? [{ rotulo: `Outros sinais da lista (${fora})`, valor: 'não tem' }] : []),
      ]}
      palpites={[
        { id: 'sem', rotulo: NIVEIS.sem.label },
        { id: 'moderado', rotulo: NIVEIS.moderado.label },
        { id: 'alto', rotulo: NIVEIS.alto.label },
      ]}
      resultado={{
        rotulo: `Score: ${score}/${total} sinais`,
        valor: label,
        tom,
        risco,
      }}
      respostaCerta={(r) => palpiteCertoDaVaga(r.risco)}
      explicacao={
        <p>
          Nenhuma empresa séria cobra taxa, curso pago ou depósito antes de contratar. Se a vaga pede dinheiro pra você
          começar, é golpe.
        </p>
      }
      principal={
        <CampoLista
          rotulo="Marque os sinais presentes na vaga que você recebeu"
          itens={SINAIS_DA_VAGA}
          marcados={marcados}
          onAlternar={alternar}
        />
      }
    />
  );
}
