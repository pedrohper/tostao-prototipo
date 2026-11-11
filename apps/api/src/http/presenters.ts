// Converte entidade em JSON de resposta. Data vira string ISO e campos internos ficam de fora.
import type { TransactionDTO } from '@tostao/contracts';
import type { Transaction } from '../domain/entities.js';

export function presentTransaction(t: Transaction & { categoryName: string | null; accountName: string | null }): TransactionDTO {
  return {
    id: t.id,
    description: t.description,
    amountInCents: t.amountInCents,
    occurredAt: t.occurredAt.toISOString(),
    categoryId: t.categoryId,
    categoryName: t.categoryName,
    accountName: t.accountName,
    isInternalTransfer: t.isInternalTransfer,
    source: t.accountId ? 'bank' : 'manual',
  };
}
