'use client';
// Controles e blocos que os simuladores dividem além do dinheiro e da régua (T6.15): escolha entre poucas opções,
// sim ou não, lista de marcar e os quadros de comparação. Alvos de 44 px ou mais, texto de 13 px pra cima.
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import type { TomDoResultado } from '@/components/simulador-shell';

export type Opcao<Id extends string | number> = { id: Id; rotulo: string };

/** Escolha única entre 2 a 4 opções. Lado a lado quando os rótulos são curtos; `empilhado` quando não cabem. */
export function CampoOpcoes<Id extends string | number>({
  rotulo,
  opcoes,
  valor,
  onChange,
  empilhado = false,
}: {
  rotulo: string;
  opcoes: readonly Opcao<Id>[];
  /** null = nada escolhido ainda. */
  valor: Id | null;
  onChange: (id: Id) => void;
  empilhado?: boolean;
}) {
  const id = useId();
  const foco = Math.max(
    0,
    opcoes.findIndex((opcao) => opcao.id === valor),
  );

  // Teclado de grupo de opções: as setas andam e já escolhem.
  const andar = (event: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const passo = ['ArrowDown', 'ArrowRight'].includes(event.key)
      ? 1
      : ['ArrowUp', 'ArrowLeft'].includes(event.key)
        ? -1
        : 0;
    if (passo === 0) return;
    event.preventDefault();
    const proximo = (indice + passo + opcoes.length) % opcoes.length;
    onChange(opcoes[proximo]!.id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[proximo]?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-[14px] leading-tight font-semibold">
        {rotulo}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className={empilhado ? 'flex flex-col gap-2' : 'grid auto-cols-fr grid-flow-col gap-2'}
      >
        {opcoes.map((opcao, indice) => {
          const marcada = opcao.id === valor;
          return (
            <button
              key={opcao.id}
              type="button"
              role="radio"
              aria-checked={marcada}
              tabIndex={indice === foco ? 0 : -1}
              onKeyDown={(event) => andar(event, indice)}
              onClick={() => onChange(opcao.id)}
              className={`min-h-12 rounded-2xl border-2 px-3 py-2 text-[14px] leading-snug font-semibold ${
                empilhado ? 'text-left' : 'text-center'
              } ${marcada ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta hover:border-tinta'}`}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SIM_NAO = [
  { id: 'sim', rotulo: 'Sim' },
  { id: 'nao', rotulo: 'Não' },
] as const;

export function CampoSimNao({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <CampoOpcoes
      rotulo={rotulo}
      opcoes={SIM_NAO}
      valor={valor ? 'sim' : 'nao'}
      onChange={(id) => onChange(id === 'sim')}
    />
  );
}

export type ItemDaLista = { id: string; rotulo: string; /** Já formatado: "R$ 45,00/mês". */ valor?: string };

/** Lista de marcar: linhas (com valor à direita) ou `chips` pra rótulos bem curtos, tipo dias da semana. */
export function CampoLista({
  rotulo,
  itens,
  marcados,
  onAlternar,
  formato = 'linhas',
  riscarMarcados = false,
}: {
  rotulo: string;
  itens: readonly ItemDaLista[];
  marcados: readonly string[];
  onAlternar: (id: string) => void;
  formato?: 'linhas' | 'chips';
  /** Pra listas em que marcar significa cortar. */
  riscarMarcados?: boolean;
}) {
  const id = useId();
  const chips = formato === 'chips';
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-[14px] leading-tight font-semibold">
        {rotulo}
      </span>
      <div role="group" aria-labelledby={id} className={chips ? 'flex flex-wrap gap-2' : 'flex flex-col gap-2'}>
        {itens.map((item) => {
          const marcado = marcados.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="checkbox"
              aria-checked={marcado}
              onClick={() => onAlternar(item.id)}
              className={
                chips
                  ? `min-h-11 min-w-12 rounded-2xl border-2 px-3 text-[14px] font-semibold ${
                      marcado ? 'border-tinta bg-tinta text-papel' : 'border-linha bg-cartao text-tinta'
                    }`
                  : `flex min-h-[52px] w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left ${
                      marcado ? 'border-tinta bg-papel-2' : 'border-linha bg-cartao'
                    }`
              }
            >
              {chips ? (
                item.rotulo
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                      marcado ? 'border-tinta bg-tinta text-papel' : 'border-tinta-suave'
                    }`}
                  >
                    {marcado && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`min-w-0 flex-1 text-[14px] leading-snug font-semibold ${
                      riscarMarcados && marcado ? 'text-tinta-suave line-through' : 'text-tinta'
                    }`}
                  >
                    {item.rotulo}
                  </span>
                  {item.valor && (
                    <span className="shrink-0 font-display text-[15px] font-extrabold text-tinta tabular-nums">
                      {item.valor}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type Quadro = { rotulo: string; valor: string; tom?: TomDoResultado; nota?: ReactNode };

const FUNDOS: Record<TomDoResultado, string> = { bom: 'bg-menta-clara', atencao: 'bg-amarelo-claro', ruim: 'bg-rosa' };

/** Até este tamanho ("R$ 800,00") dois valores cabem lado a lado em 320 px. */
const CABE_LADO_A_LADO = 9;

/**
 * Os números de apoio ("em 3 meses", "em 1 ano"). Dois valores curtos ficam lado a lado; o resto vira linhas, que
 * cabem em 320 px sem partir o valor. Vai em `detalhes` do shell.
 */
export function Quadros({ titulo, itens }: { titulo?: string; itens: readonly Quadro[] }) {
  const lado = itens.length === 2 && itens.every((item) => item.valor.length <= CABE_LADO_A_LADO);
  return (
    <section className="flex flex-col gap-2" aria-label={titulo ?? 'Comparação'}>
      {titulo && <h3 className="text-xs font-semibold tracking-[0.08em] text-tinta-suave uppercase">{titulo}</h3>}
      <dl className={lado ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2'}>
        {itens.map((item) => (
          <div
            key={item.rotulo}
            className={`rounded-2xl px-3.5 py-3 ${item.tom ? FUNDOS[item.tom] : 'bg-papel-2'} ${
              lado ? 'flex flex-col gap-0.5' : 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5'
            }`}
          >
            <dt className="min-w-0 text-[13px] leading-snug font-semibold text-tinta">{item.rotulo}</dt>
            <dd className="font-display text-[20px] leading-tight font-extrabold break-words text-tinta tabular-nums">
              {item.valor}
            </dd>
            {item.nota && <dd className="w-full text-[13px] leading-snug text-tinta">{item.nota}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
