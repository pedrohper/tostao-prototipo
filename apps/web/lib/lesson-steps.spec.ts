import { describe, expect, it } from 'vitest';
import { canGoBack, previousStep } from './lesson-steps';

describe('voltar entre os passos da lição', () => {
  it('pode voltar do conceito, do simulador e do dilema (1 a 3)', () => {
    for (const step of [1, 2, 3]) {
      expect(canGoBack(step)).toBe(true);
      expect(previousStep(step)).toBe(step - 1);
    }
  });

  it('não volta do gancho (tem o ×), nem da conclusão e do desafio (a lição já foi registrada)', () => {
    for (const step of [0, 4, 5, -1, 99, 1.5, Number.NaN]) {
      expect(canGoBack(step)).toBe(false);
      expect(previousStep(step)).toBe(step);
    }
  });

  it('voltar até o começo e avançar de novo não pula nada', () => {
    let step = 3;
    const visited = [step];
    while (canGoBack(step)) {
      step = previousStep(step);
      visited.push(step);
    }
    expect(visited).toEqual([3, 2, 1, 0]);
  });
});
