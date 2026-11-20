import type { Repositories } from '../repositories/types.js';
import { AppError } from '../domain/errors.js';
import type { PendingActionStore } from '../services/pending-actions.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const EXPIRED = 'Essa confirmação expirou ou já foi usada. Pede de novo pro Tostão que eu refaço.';

/** Confirma (ou cancela) o que a IA propôs. É AQUI, e só aqui, que a transação da IA é gravada. */
export class PendingActionUseCase {
  constructor(
    private readonly store: PendingActionStore,
    private readonly repos: Repositories,
  ) {}

  /** `actionId` omitido = a última proposta da pessoa (é o caso do "SIM" no WhatsApp). */
  async confirm({ userId, actionId }: { userId: string; actionId?: string }) {
    const action = await this.store.consume(userId, actionId);
    if (!action) throw new AppError(EXPIRED, 410);
    const { transaction } = await new CreateManualTransactionUseCase(this.repos).execute({
      userId,
      description: action.description,
      amountInCents: action.amountInCents,
      kind: action.type,
      occurredAt: new Date(`${action.date}T12:00:00-03:00`),
      categoryId: action.categoryId,
    });
    return {
      transactionId: transaction.id,
      message: `Anotado: ${action.description}, ${action.type === 'saida' ? '-' : '+'}${brl(action.amountInCents)}.`,
    };
  }

  async cancel({ userId, actionId }: { userId: string; actionId?: string }) {
    const action = await this.store.consume(userId, actionId);
    if (!action) throw new AppError(EXPIRED, 410);
    return { message: 'Beleza, não anotei nada.' };
  }

  /** Há algo esperando "SIM"? (WhatsApp) */
  async hasPending(userId: string) {
    return (await this.store.peek(userId)) !== null;
  }
}
