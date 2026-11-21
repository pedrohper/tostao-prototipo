// Passos do player da lição: 0 gancho, 1 conceito, 2 simulador, 3 dilema, 4 conclusão, 5 desafio da semana.
// Dá pra voltar entre o conceito e o dilema (1 a 3). No passo 0 já existe o "×"; depois de concluir (4 e 5) a lição
// foi registrada, então voltar reabriria o dilema e confundiria o XP e a sequência: não existe.

export const LAST_BACKABLE_STEP = 3;

export function canGoBack(step: number): boolean {
  return Number.isInteger(step) && step >= 1 && step <= LAST_BACKABLE_STEP;
}

export function previousStep(step: number): number {
  return canGoBack(step) ? step - 1 : step;
}
