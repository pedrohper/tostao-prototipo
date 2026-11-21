// Aposta (bet, "tigrinho"): UMA definição pro app todo. A batalha do Tigrinho e o aviso do Tostão Auto usam a mesma.
import type { Transaction } from '../domain/entities.js';

export const BET_HINT =
  /\b(bet365|betano|pixbet|sportingbet|blaze|tigrinho|fortune tiger|superbet|kto|estrelabet|novibet|esportes da sorte)\b/i;

/** Saída (não transferência) que a categoria "apostas" OU o nome da casa de apostas denunciam. */
export const isBetTransaction = (
  t: Pick<Transaction, 'categoryId' | 'amountInCents' | 'isInternalTransfer' | 'description'>,
) => t.amountInCents < 0 && !t.isInternalTransfer && (t.categoryId === 'apostas' || BET_HINT.test(t.description));
