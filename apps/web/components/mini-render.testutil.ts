// Renderizador de TESTE sem DOM (o projeto não tem jsdom): chama os componentes, guarda o estado dos hooks pela posição
// na árvore e devolve só as tags, pra dar pra tocar, digitar e conferir o que aparece. Cobre os hooks que os
// simuladores usam (useState, useRef, useId e useEffect, este sem rodar o efeito). Fora do `montar`, valem os hooks
// de verdade, então `renderToString` continua funcionando no mesmo arquivo de teste.
// Não importa 'react' (é ele que o teste substitui).
import type { ReactElement, ReactNode } from 'react';

type Quadro = { caminho: string; valores: unknown[]; indice: number };

let quadro: Quadro | null = null;

type ReactDeVerdade = typeof import('react');

/** Para o `vi.mock('react', ...)`: o React de verdade, com os hooks desviados só enquanto o `montar` está rodando. */
export function comGanchosDeTeste(real: ReactDeVerdade): ReactDeVerdade {
  const useState = (inicial: unknown) => {
    if (!quadro) return real.useState(inicial);
    const { valores } = quadro;
    const i = quadro.indice++;
    if (!(i in valores)) valores[i] = typeof inicial === 'function' ? (inicial as () => unknown)() : inicial;
    const definir = (proximo: unknown) => {
      valores[i] = typeof proximo === 'function' ? (proximo as (v: unknown) => unknown)(valores[i]) : proximo;
    };
    return [valores[i], definir];
  };
  const useRef = (inicial: unknown) => {
    if (!quadro) return real.useRef(inicial);
    const i = quadro.indice++;
    if (!(i in quadro.valores)) quadro.valores[i] = { current: inicial };
    return quadro.valores[i];
  };
  const useId = () => {
    if (!quadro) return real.useId();
    return `id-${quadro.caminho}-${quadro.indice++}`.replace(/[^\w-]/g, '_');
  };
  const useEffect = (efeito: () => void, deps?: unknown[]) => {
    if (!quadro) real.useEffect(efeito, deps);
  };
  return { ...real, useState, useRef, useId, useEffect } as unknown as ReactDeVerdade;
}

export type Props = Record<string, unknown>;
export type No = { tag: string; props: Props; filhos: (No | string)[] };

const FRAGMENTO = Symbol.for('react.fragment');

export function montar(elemento: ReactElement) {
  const memoria = new Map<string, unknown[]>();
  let arvore: (No | string)[] = [];

  const expandir = (no: ReactNode, caminho: string): (No | string)[] => {
    if (no === null || no === undefined || typeof no === 'boolean') return [];
    if (typeof no === 'string' || typeof no === 'number') return [String(no)];
    if (Array.isArray(no)) {
      return no.flatMap((filho, i) => expandir(filho, `${caminho}.${(filho as ReactElement | null)?.key ?? i}`));
    }
    const { type, props } = no as ReactElement<Props>;
    if (typeof type === 'function') {
      const aqui = `${caminho}/${type.name}`;
      const valores = memoria.get(aqui) ?? [];
      memoria.set(aqui, valores);
      const anterior = quadro;
      quadro = { caminho: aqui, valores, indice: 0 };
      try {
        const saida = (type as (p: Props) => ReactNode)(props);
        quadro = anterior;
        return expandir(saida, aqui);
      } finally {
        quadro = anterior;
      }
    }
    // Filho único (sem array) entra no índice do pai: `[false, <x/>]` mantém a posição de cada irmão.
    const filhos = (props as { children?: ReactNode }).children;
    if ((type as unknown) === FRAGMENTO) return expandir(filhos, `${caminho}/f`);
    if (typeof type === 'string') return [{ tag: type, props, filhos: expandir(filhos, `${caminho}/${type}`) }];
    throw new Error(`montar: tipo de elemento não suportado em ${caminho}`);
  };

  const desenhar = () => {
    arvore = expandir(elemento, 'raiz');
  };
  desenhar();

  const todos = (filtro: (no: No) => boolean) => {
    const achados: No[] = [];
    const andar = (lista: (No | string)[]) => {
      for (const no of lista) {
        if (typeof no === 'string') continue;
        if (filtro(no)) achados.push(no);
        andar(no.filhos);
      }
    };
    andar(arvore);
    return achados;
  };

  const um = (filtro: (no: No) => boolean, nome = 'elemento') => {
    const [primeiro] = todos(filtro);
    if (!primeiro) throw new Error(`montar: não achei ${nome}`);
    return primeiro;
  };

  const juntar = (lista: (No | string)[]): string =>
    lista.map((no) => (typeof no === 'string' ? no : ` ${juntar(no.filhos)} `)).join('');

  /** Texto visível (da árvore toda ou de um nó), com os espaços normalizados. */
  const texto = (no?: No) =>
    juntar(no ? no.filhos : arvore)
      .replace(/\s+/g, ' ')
      .trim();

  /** Dispara um evento do nó e redesenha. Os nós buscados antes ficam velhos: busque de novo. */
  const disparar = (no: No, evento: string, dados: unknown = {}) => {
    const tratador = no.props[evento] as ((e: unknown) => void) | undefined;
    if (!tratador) throw new Error(`montar: <${no.tag}> não tem ${evento}`);
    tratador(dados);
    desenhar();
  };

  return { todos, um, texto, disparar };
}
