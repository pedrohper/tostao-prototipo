import { randomUUID } from 'node:crypto';
import type { ReconcileBalanceResponse } from '@tostao/contracts';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import type { Repositories } from '../repositories/types.js';
import { IMPORT_PREFIX } from './import-statement.js';
import { isManualAccount } from '../services/manual-balance.js';

export const ADJUSTMENT_DESCRIPTION = 'Ajuste de saldo';

/**
 * "Conferir / Ajustar saldo atual": a pessoa diz o saldo que o banco mostra e o Tostão lança UM ajuste com a diferença
 * (centavos, tarifa, o que ficou sem anotar). Só pra conta manual ou importada: conta ligada ao banco tem o saldo do banco.
 * O ajuste é transferência interna (não vira gasto nem renda) e fixa o saldo no valor informado.
 */
export class ReconcileBalanceUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'accounts' | 'transactions' | 'tx'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({
    userId,
    accountId,
    targetBalanceInCents,
    note,
  }: {
    userId: string;
    accountId: string;
    targetBalanceInCents: number;
    note?: string;
  }): Promise<ReconcileBalanceResponse> {
    const now = this.now();
    return this.repos.tx(async (r) => {
      // Lido DENTRO da transação: o delta usa o saldo mais recente possível.
      const account = (await r.accounts.listByUser(userId)).find((a) => a.id === accountId);
      if (!account) throw new ResourceNotFoundError('Conta');
      if (!isManualAccount(account) && !account.externalId.startsWith(IMPORT_PREFIX))
        throw new AppError(
          'O saldo dessa conta vem direto do banco. Só dá pra ajustar conta manual ou importada.',
          400,
        );
      const delta = targetBalanceInCents - account.balanceInCents;
      if (delta === 0) return { deltaInCents: 0, balanceInCents: account.balanceInCents, transactionId: null };
      const manual = isManualAccount(account);
      const id = randomUUID();
      await r.transactions.createMany([
        {
          id,
          userId,
          accountId: account.id,
          externalId: null,
          description: ADJUSTMENT_DESCRIPTION,
          amountInCents: delta,
          occurredAt: now,
          categoryId: null,
          // Não é gasto nem renda, e nada (sync, importação) reclassifica: a pessoa decidiu.
          isInternalTransfer: true,
          internalTransferManual: true,
          seriesId: null,
          note: note || null,
          settledAt: now,
          balanceAppliedAt: manual ? now : null,
        },
      ]);
      await r.accounts.adjustBalance(account.id, delta);
      return { deltaInCents: delta, balanceInCents: targetBalanceInCents, transactionId: id };
    });
  }
}
