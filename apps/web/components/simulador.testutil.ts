// Ajudantes das specs de simulador (usam o renderizador sem DOM do mini-render). Quem importa precisa ter no topo o
// `vi.mock('react', ...)` com `comGanchosDeTeste`.
import type { ReactElement } from 'react';
import { createElement } from 'react';
import { expect } from 'vitest';
import { montar, type No } from './mini-render.testutil';

export type Tela = ReturnType<typeof montar>;
type Componente = () => React.ReactNode;

export const plain = (s: string) =>
  s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Todas as posições de uma régua. */
export const regua = (min: number, max: number, passo: number) =>
  Array.from({ length: Math.round((max - min) / passo) + 1 }, (_, i) => min + i * passo);

const elemento = (Sim: Componente) => createElement(Sim as () => ReactElement);

/** O simulador já no resultado: pula o palpite, se houver. */
export function aberto(Sim: Componente): Tela {
  const tela = montar(elemento(Sim));
  const [pular] = tela.todos((no) => no.tag === 'button' && tela.texto(no) === 'Pular palpite');
  if (pular) tela.disparar(pular, 'onClick');
  return tela;
}

/** O texto da tela depois de chutar a opção `indice`. */
export function palpitar(Sim: Componente, indice: number): string {
  const tela = montar(elemento(Sim));
  tela.disparar(tela.todos((no) => no.props.role === 'radio')[indice]!, 'onClick');
  return tudo(tela);
}

export const tudo = (tela: Tela) => plain(tela.texto());
/** O cartão grande do resultado. */
export const grande = (tela: Tela) => plain(tela.texto(tela.um((no) => no.props['aria-live'] === 'polite')));

export const reguas = (tela: Tela) => tela.todos((no) => no.tag === 'input' && no.props.type === 'range');
export const reguaDe = (tela: Tela, rotulo: string): No =>
  tela.um((no) => no.props.type === 'range' && no.props['aria-label'] === rotulo, `a régua "${rotulo}"`);
export const mover = (tela: Tela, rotulo: string, valor: number) =>
  tela.disparar(reguaDe(tela, rotulo), 'onChange', { target: { value: String(valor) } });
/** [rótulo, valor, min, max, passo] de cada régua, na ordem da tela. */
export const limites = (tela: Tela) =>
  reguas(tela).map((r) => [r.props['aria-label'], r.props.value, r.props.min, r.props.max, r.props.step]);

/** Toca no botão (opção, item de lista, ação) cujo texto contém `rotulo`. */
export function tocar(tela: Tela, rotulo: string) {
  const botao = tela.um((no) => no.tag === 'button' && plain(tela.texto(no)).includes(rotulo), `o botão "${rotulo}"`);
  tela.disparar(botao, 'onClick');
}

/** O controle principal fica à vista: não está dentro do "Ajustar mais", que nasce fechado. */
export function principalForaDoMais(tela: Tela, rotulo: string) {
  const mais = tela.um((no) => no.tag === 'details');
  expect(mais.props.open).toBeUndefined();
  expect(plain(tela.texto(mais))).not.toContain(rotulo);
}
