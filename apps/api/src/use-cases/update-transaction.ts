import type { UpdateTransactionBody } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';

/** Atualiza transferência interna (qualquer transação) ou campos de lançamentos anotados à mão. */
export class UpdateTransactionUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions'>) {}

  async execute({
    userId,
    transactionId,
    ...patch
  }: UpdateTransactionBody & { userId: string; transactionId: string }) {
    const t = await this.repos.transactions.findById(transactionId);
    if (!t || t.userId !== userId) throw new ResourceNotFoundError('Lançamento');

    const editsManualField =
      patch.description !== undefined || patch.amountInCents !== undefined || patch.occurredAt !== undefined;
    if (editsManualField && t.externalId) {
      throw new AppError('Só dá pra editar descrição, valor e data de lançamentos anotados à mão.', 400);
    }

    const updated = {
      ...t,
      ...(patch.isInternalTransfer !== undefined ? { isInternalTransfer: patch.isInternalTransfer } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.amountInCents !== undefined ? { amountInCents: patch.amountInCents } : {}),
      ...(patch.occurredAt !== undefined ? { occurredAt: new Date(`${patch.occurredAt}T12:00:00-03:00`) } : {}),
    };
    await this.repos.transactions.save(updated);
    return { transaction: updated };
  }
}
