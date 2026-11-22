import type { UpdateTransactionBody } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import { noonOfCivilDay } from '../lib/tz.js';
import { timezoneOf } from '../lib/user-tz.js';
import { isBankSourced } from '../services/app-entries.js';
import { balanceEffect, isDue, isManualAccount } from '../services/manual-balance.js';

/** Atualiza transferência interna (qualquer transação) ou campos de lançamentos anotados à mão. */
export class UpdateTransactionUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'accounts' | 'users' | 'tx'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({
    userId,
    transactionId,
    ...patch
  }: UpdateTransactionBody & { userId: string; transactionId: string }) {
    const t = await this.repos.transactions.findById(transactionId);
    if (!t || t.userId !== userId) throw new ResourceNotFoundError('Lançamento');

    const editsManualField =
      patch.description !== undefined || patch.amountInCents !== undefined || patch.occurredAt !== undefined;
    if (editsManualField && isBankSourced(t.externalId)) {
      throw new AppError('Só dá pra editar descrição, valor e data de lançamentos anotados à mão.', 400);
    }

    // Ligado a fatura/conta (T5.2): desmarcar "transferência" aqui deixaria a contrapartida e o saldo do outro lado soltos.
    if (patch.isInternalTransfer === false && t.linkKind)
      throw new AppError('Esse lançamento está ligado a outra conta. Desfaça o vínculo primeiro.', 400);

    const tz = await timezoneOf(this.repos.users, userId);
    const updated = {
      ...t,
      ...(patch.isInternalTransfer !== undefined
        ? {
            isInternalTransfer: patch.isInternalTransfer,
            // A pessoa disse (true ou false): o sync e a importação nunca mais reclassificam este lançamento.
            internalTransferManual: patch.isInternalTransfer,
          }
        : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.amountInCents !== undefined ? { amountInCents: patch.amountInCents } : {}),
      ...(patch.occurredAt !== undefined ? { occurredAt: noonOfCivilDay(patch.occurredAt, tz) } : {}),
      // A anotação é da pessoa: vale também pra transação do banco. Vazio apaga.
      ...(patch.note !== undefined ? { note: patch.note || null } : {}),
      // O apelido também vale pra transação do banco e nunca mexe na `description` original.
      ...(patch.customDescription !== undefined ? { customDescription: patch.customDescription?.trim() || null } : {}),
    };
    const now = this.now();
    await this.repos.tx(async (r) => {
      const account = t.accountId ? (await r.accounts.listByUser(userId)).find((a) => a.id === t.accountId) : null;
      if (account && isManualAccount(account)) {
        // Conta manual: o saldo acompanha a edição. Depois de editar, pesa no saldo quem já tem a data chegada.
        const applied = isDue(updated, now);
        updated.balanceAppliedAt = applied ? (t.balanceAppliedAt ?? now) : null;
        const delta = balanceEffect(updated) - balanceEffect(t);
        await r.transactions.save(updated);
        if (delta !== 0) await r.accounts.adjustBalance(account.id, delta);
      } else {
        await r.transactions.save(updated);
      }
    });
    return { transaction: updated };
  }
}
