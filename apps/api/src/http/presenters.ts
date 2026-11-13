// Converte entidade em JSON de resposta. Data vira string ISO e campos internos ficam de fora.
import type { TransactionDTO } from '@tostao/contracts';
import type { Transaction } from '../domain/entities.js';

export function presentTransaction(t: Transaction & { categoryName: string | null; categoryEmoji?: string | null; categoryColor?: string | null; accountName: string | null }): TransactionDTO {
  return {
    id: t.id,
    description: t.description,
    amountInCents: t.amountInCents,
    occurredAt: t.occurredAt.toISOString(),
    categoryId: t.categoryId,
    categoryName: t.categoryName,
    categoryEmoji: t.categoryEmoji ?? null,
    categoryColor: t.categoryColor ?? null,
    accountName: t.accountName,
    isInternalTransfer: t.isInternalTransfer,
    source: t.externalId ? 'bank' : 'manual',
    seriesId: t.seriesId ?? null,
  };
}
