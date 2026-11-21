import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { balanceEffect, isManualAccount } from '../services/manual-balance.js';

/** Apaga um lançamento anotado à mão. Com `series`, leva junto as próximas ocorrências (todo mês / parcelas). Do banco não dá. */
export class DeleteTransactionUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'accounts' | 'tx'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({
    userId,
    transactionId,
    series = false,
  }: {
    userId: string;
    transactionId: string;
    series?: boolean;
  }) {
    const t = await this.repos.transactions.findById(transactionId);
    if (!t || t.userId !== userId || t.externalId) throw new ResourceNotFoundError('Lançamento');
    const now = this.now();
    const wholeSeries = series && t.seriesId;
    // Quem vai sair (a própria, ou ela e as próximas da série): é o que o saldo da conta manual precisa devolver.
    const going = wholeSeries
      ? (await this.repos.transactions.findManualByUser(userId)).filter(
          (x) => x.seriesId === t.seriesId && x.occurredAt >= t.occurredAt,
        )
      : [t];
    return this.repos.tx(async (r) => {
      const account = t.accountId ? (await r.accounts.listByUser(userId)).find((a) => a.id === t.accountId) : null;
      if (account && isManualAccount(account)) {
        const delta = going.reduce((sum, x) => sum - balanceEffect(x, now), 0);
        if (delta !== 0) await r.accounts.adjustBalance(account.id, delta);
      }
      if (wholeSeries) return { deleted: await r.transactions.deleteSeriesFrom(userId, t.seriesId!, t.occurredAt) };
      await r.transactions.delete(t.id);
      return { deleted: 1 };
    });
  }
}
