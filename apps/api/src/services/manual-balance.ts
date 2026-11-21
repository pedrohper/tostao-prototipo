// Saldo de conta MANUAL ("Cartão do meu pai", dinheiro guardado em casa): não existe banco que atualize o saldo,
// então o próprio app o mantém. Cada lançamento anotado nessa conta soma (ou subtrai) no saldo, de forma atômica
// (balance = balance + delta), dentro da mesma transação que grava o lançamento.
// Conta conectada (Pluggy/arquivo) NÃO entra aqui: o saldo dela vem do banco, e anotação à mão não mexe nele.
import type { Account } from '../domain/entities.js';
import { MANUAL_PREFIX } from '../use-cases/import-statement.js';

export const isManualAccount = (a: Pick<Account, 'externalId'>) => a.externalId.startsWith(MANUAL_PREFIX);

/**
 * Quanto um lançamento pesa HOJE no saldo: o valor inteiro se já aconteceu (occurredAt <= agora), zero se é futuro
 * (parcela/"todo mês" que ainda vai chegar não mexe no saldo de hoje).
 */
export const balanceEffect = (t: { amountInCents: number; occurredAt: Date }, now: Date) =>
  t.occurredAt <= now ? t.amountInCents : 0;
