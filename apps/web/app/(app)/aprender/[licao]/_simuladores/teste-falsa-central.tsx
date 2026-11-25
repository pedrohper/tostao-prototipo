'use client';
// m9-l1: O teste da falsa central, no SimuladorShell (T6.15). Já é um quiz, então abre sem palpite: um caso por vez e o
// resultado conta os acertos. Casos, textos e gabarito são os de sempre; só a posição da opção certa alterna.
import { useState } from 'react';
import { Selo } from '@/components/selo';
import { CampoOpcoes } from '@/components/simulador-campos';
import { SimuladorShell } from '@/components/simulador-shell';

export const CASOS_DA_FALSA_CENTRAL = [
  {
    titulo: '1. SMS de compra suspeita',
    texto: '"BANCO: Compra de R$ 2.890 aprovada agora. Não reconhece? Ligue 0800-999-4120."',
    opcoes: [
      { label: 'O valor alto da compra', correto: false },
      { label: 'Número 0800 enviado no SMS', correto: true },
    ],
    explicacao:
      'Golpistas criam um 0800 falso para você ligar para a "falsa central". Sempre abra o app oficial do banco.',
  },
  {
    titulo: '2. Ligação da "segurança"',
    texto: '"Sua conta foi invadida. Para bloquear, faça um Pix para a conta segura do Banco Central."',
    opcoes: [
      { label: 'Pedir Pix para "conta segura"', correto: true },
      { label: 'Falar sobre invasão de conta', correto: false },
    ],
    explicacao: 'Nenhum banco ou Banco Central pede transferência ou Pix para proteger dinheiro. Isso é 100% golpe.',
  },
  {
    titulo: '3. Link de atualização',
    texto: '"Seu app será bloqueado hoje! Atualize seu token em: banco-seguro-atualiza.com"',
    opcoes: [
      { label: 'Mencionar token do app', correto: false },
      { label: 'Domínio estranho + urgência', correto: true },
    ],
    explicacao: 'Links fora do domínio oficial com ameaça de bloqueio imediato são phishing clássico.',
  },
] as const;

/** O gabarito: a posição da opção certa de um caso. */
export const opcaoCertaDoCaso = (caso: number) =>
  CASOS_DA_FALSA_CENTRAL[caso]!.opcoes.findIndex((opcao) => opcao.correto);

/** `respostas` = número do caso → posição da opção escolhida. */
export function corrigirRespostas(respostas: Readonly<Record<number, number>>) {
  const acertos = CASOS_DA_FALSA_CENTRAL.filter(
    (c, i) => respostas[i] !== undefined && c.opcoes[respostas[i]]?.correto,
  ).length;
  const respondidos = CASOS_DA_FALSA_CENTRAL.filter((_, i) => respostas[i] !== undefined).length;
  return { acertos, respondidos };
}

const BOTAO =
  'min-h-11 rounded-full border-2 border-linha bg-cartao px-4 text-[14px] font-semibold text-tinta enabled:hover:border-tinta disabled:opacity-40';

export function TesteFalsaCentral() {
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [atual, setAtual] = useState(0);

  const total = CASOS_DA_FALSA_CENTRAL.length;
  const { acertos, respondidos } = corrigirRespostas(respostas);
  const caso = CASOS_DA_FALSA_CENTRAL[atual]!;
  const escolhida = respostas[atual];
  const acertou = escolhida === opcaoCertaDoCaso(atual);

  return (
    <SimuladorShell
      pergunta="Você acha o sinal de golpe em cada abordagem?"
      resultado={{
        rotulo: 'Sinais de golpe',
        valor: `${acertos}/${total} identificados`,
        nota: `${respondidos} de ${total} casos respondidos`,
        tom: acertos === total ? 'bom' : respondidos === total ? 'ruim' : 'atencao',
      }}
      explicacao={<p>Clique no sinal de golpe em cada caso. A explicação aparece depois da sua resposta.</p>}
      principal={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">
              Caso {atual + 1} de {total}
            </span>
            <h3 className="text-[15px] font-extrabold text-tinta">{caso.titulo}</h3>
            <p className="rounded-2xl bg-papel-2 p-3 text-[14px] leading-relaxed break-words text-tinta italic">
              {caso.texto}
            </p>
          </div>

          <CampoOpcoes
            rotulo="Qual é o sinal de golpe?"
            opcoes={caso.opcoes.map((opcao, i) => ({ id: i, rotulo: opcao.label }))}
            valor={escolhida ?? null}
            onChange={(opcao) => setRespostas((antes) => ({ ...antes, [atual]: opcao }))}
            empilhado
          />

          {/* Existe desde antes da resposta, pra o leitor de tela anunciar a correção. */}
          <div role="status">
            {escolhida !== undefined && (
              <p
                className={`rounded-2xl p-3 text-[14px] leading-relaxed ${
                  acertou ? 'bg-menta-clara text-verde-texto' : 'bg-rosa text-vermelho-texto'
                }`}
              >
                <Selo tipo={acertou ? 'ok' : 'erro'} />
                <b>{acertou ? 'Isso!' : 'Não é esse.'}</b> {caso.explicacao}
              </p>
            )}
          </div>

          <div className="flex justify-between gap-3">
            <button type="button" disabled={atual === 0} onClick={() => setAtual(atual - 1)} className={BOTAO}>
              Voltar
            </button>
            <button type="button" disabled={atual === total - 1} onClick={() => setAtual(atual + 1)} className={BOTAO}>
              Próximo caso
            </button>
          </div>
        </div>
      }
    />
  );
}
