import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import { isBankSourced, linkExternalId } from '../services/app-entries.js';
import { balanceEffect, isManualAccount } from '../services/manual-balance.js';

/** Apaga um lançamento anotado à mão. Com `series`, leva junto as próximas ocorrências (todo mês / parcelas). Do banco não dá. */
export class DeleteTransactionUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'accounts' | 'tx'>,
    _now: () => Date = () => new Date(),
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
    if (!t || t.userId !== userId || isBankSourced(t.externalId)) throw new ResourceNotFoundError('Lançamento');
    // A outra ponta de um vínculo só some junto com o vínculo (senão o original ficaria "transferido pra lugar nenhum").
    if (t.externalId?.startsWith('link:'))
      throw new AppError(
        'Esse lançamento é a outra ponta de uma transferência: desfaça o vínculo no lançamento original.',
        400,
      );
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
        const delta = going.reduce((sum, x) => sum - balanceEffect(x), 0);
        if (delta !== 0) await r.accounts.adjustBalance(account.id, delta);
      }
      // Contrapartida de um vínculo de transferência/fatura (`link:<id>`): sai junto, devolvendo o saldo dela.
      const accounts = await r.accounts.listByUser(userId);
      for (const x of going) {
        const mirror = await r.transactions.findByExternalId(userId, linkExternalId(x.id));
        if (!mirror) continue;
        const acc = mirror.accountId ? accounts.find((a) => a.id === mirror.accountId) : null;
        if (acc && isManualAccount(acc) && balanceEffect(mirror) !== 0)
          await r.accounts.adjustBalance(acc.id, -balanceEffect(mirror));
        await r.transactions.delete(mirror.id);
      }
      if (wholeSeries) return { deleted: await r.transactions.deleteSeriesFrom(userId, t.seriesId!, t.occurredAt) };
      await r.transactions.delete(t.id);
      return { deleted: 1 };
    });
  }
}
