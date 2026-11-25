// T6.15 (lote A): palpites em dinheiro "em volta" da resposta, pra quando não há uma faixa natural pra chutar.
// A certa muda de lugar conforme um número do próprio cenário (sem sorteio: servidor e navegador desenham igual).

export type IdDoValor = 'a' | 'b' | 'c';
export type PalpiteDeValor = { id: IdDoValor; cents: number };

const IDS = ['a', 'b', 'c'] as const;
/** Cada linha deixa a certa (fator 1) numa posição, sempre em ordem crescente. */
const FATORES = [
  [1, 1.5, 2],
  [0.5, 1, 1.5],
  [0.25, 0.5, 1],
] as const;

/** Três valores diferentes (com `certoCents` a partir de 4 centavos), um deles o certo. */
export function palpitesEmVolta(certoCents: number, semente: number): PalpiteDeValor[] {
  const fatores = FATORES[semente % FATORES.length]!;
  return fatores.map((fator, i) => ({ id: IDS[i]!, cents: Math.round(certoCents * fator) }));
}

/** O palpite mais perto do valor (o próprio, quando os palpites saíram dele). */
export function palpiteCertoEmValor(opcoes: readonly PalpiteDeValor[], valorCents: number): IdDoValor {
  const distancia = (o: PalpiteDeValor) => Math.abs(o.cents - valorCents);
  return opcoes.reduce((melhor, o) => (distancia(o) < distancia(melhor) ? o : melhor)).id;
}
