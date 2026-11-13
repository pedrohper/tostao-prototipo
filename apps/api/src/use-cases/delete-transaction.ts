import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';

/** Apaga um lançamento anotado à mão. Com `series`, leva junto as próximas ocorrências (todo mês / parcelas). Do banco não dá. */
export class DeleteTransactionUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions'>) {}

  async execute({ userId, transactionId, series = false }: { userId: string; transactionId: string; series?: boolean }) {
    const t = await this.repos.transactions.findById(transactionId);
    if (!t || t.userId !== userId || t.externalId) throw new ResourceNotFoundError('Lançamento');
    if (series && t.seriesId) return { deleted: await this.repos.transactions.deleteSeriesFrom(userId, t.seriesId, t.occurredAt) };
    await this.repos.transactions.delete(t.id);
    return { deleted: 1 };
  }
}
