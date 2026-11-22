// Saldo de conta MANUAL ("Cartão do meu pai", dinheiro guardado em casa): não existe banco que atualize o saldo,
// então o próprio app o mantém. Cada lançamento anotado nessa conta soma (ou subtrai) no saldo, de forma atômica
// (balance = balance + delta), dentro da mesma transação que grava o lançamento.
// Conta conectada (Pluggy/arquivo) NÃO entra aqui: o saldo dela vem do banco, e anotação à mão não mexe nele.
import type { Account } from '../domain/entities.js';
import { MANUAL_PREFIX } from '../use-cases/import-statement.js';

export const isManualAccount = (a: Pick<Account, 'externalId'>) => a.externalId.startsWith(MANUAL_PREFIX);

/**
 * Quanto um lançamento JÁ pesa no saldo: o valor inteiro se `balanceAppliedAt` está preenchido, zero se não
 * (parcela/"todo mês" futura ainda não mexeu no saldo). A trava vive no banco: quem aplica de fato é sempre
 * `claimBalanceApplication` (UPDATE condicional), então o job de materialização e a edição nunca aplicam 2x.
 */
export const balanceEffect = (t: { amountInCents: number; balanceAppliedAt?: Date | null }) =>
  t.balanceAppliedAt ? t.amountInCents : 0;

/** A data do lançamento já chegou? (`occurredAt <= agora`): então ele deve pesar no saldo, se for de conta manual. */
export const isDue = (t: { occurredAt: Date }, now: Date) => t.occurredAt <= now;
