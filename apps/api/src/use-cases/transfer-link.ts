import type { TransferLinkBody } from '@tostao/contracts';
import type { Account, Transaction } from '../domain/entities.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';
import type { Repositories } from '../repositories/types.js';
import { linkExternalId } from '../services/app-entries.js';
import { balanceEffect, isDue, isManualAccount } from '../services/manual-balance.js';

/**
 * Vínculo explícito de um lançamento com outra conta MINHA (detalhe do lançamento):
 *  - "É pagamento de fatura": o outro lado é o cartão;
 *  - "Transferi pra outra conta minha": o outro lado é a conta de destino.
 * O lançamento vira transferência interna (sai dos gastos e da renda; `internalTransferManual = true`, então nada
 * reclassifica) e guarda o outro lado. Se o outro lado é conta MANUAL, o app cria a contrapartida (`link:<id>`) e ajusta
 * o saldo dela; se é conta ligada ao banco, o banco traz a contrapartida sozinho (o par é reconhecido no sync).
 * `none` desfaz tudo, inclusive a contrapartida e o saldo dela.
 */
export class TransferLinkUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'transactions' | 'accounts' | 'tx'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({
    userId,
    transactionId,
    kind,
    targetAccountId,
  }: TransferLinkBody & { userId: string; transactionId: string }) {
    const now = this.now();
    return this.repos.tx(async (r) => {
      const t = await r.transactions.findById(transactionId);
      if (!t || t.userId !== userId) throw new ResourceNotFoundError('Lançamento');
      if (t.externalId?.startsWith('link:'))
        throw new AppError('Esse lançamento é a outra ponta de uma transferência. Mexa no lançamento original.', 400);
      const accounts = await r.accounts.listByUser(userId);
      const source = t.accountId ? (accounts.find((a) => a.id === t.accountId) ?? null) : null;

      let target: Account | null = null;
      if (kind !== 'none') {
        target = accounts.find((a) => a.id === targetAccountId) ?? null;
        if (!target) throw new ResourceNotFoundError('Conta');
        if (target.id === t.accountId) throw new AppError('Escolha uma conta diferente da deste lançamento.', 400);
        const cards = [source, target].filter((a) => a?.type === 'CREDIT').length;
        if (kind === 'card_payment' && cards !== 1)
          throw new AppError('Pagamento de fatura liga uma conta a um cartão.', 400);
        if (kind === 'transfer' && cards !== 0)
          throw new AppError('Pra pagar cartão, use "É pagamento de fatura".', 400);
      }

      // Contrapartida anterior (trocou de conta ou desfez): sai, devolvendo o saldo que ela moveu.
      const old = await r.transactions.findByExternalId(userId, linkExternalId(t.id));
      if (old) await this.removeMirror(r, old, accounts);

      if (kind === 'none') {
        await r.transactions.save({
          ...t,
          isInternalTransfer: false,
          internalTransferManual: false,
          linkedAccountId: null,
          linkKind: null,
        });
        return {
          linkedAccountId: null as string | null,
          linkKind: null as TransferLinkBody['kind'] | null,
          mirrorId: null as string | null,
        };
      }

      let mirrorId: string | null = null;
      if (target && isManualAccount(target)) {
        const applied = isDue(t, now);
        const mirror = await r.transactions.create({
          userId,
          accountId: target.id,
          externalId: linkExternalId(t.id),
          description:
            kind === 'card_payment'
              ? 'Pagamento de fatura'
              : `Transferência ${source ? `de ${source.name}` : 'recebida'}`,
          amountInCents: -t.amountInCents,
          occurredAt: t.occurredAt,
          categoryId: null,
          isInternalTransfer: true,
          internalTransferManual: true,
          seriesId: null,
          linkedAccountId: source?.id ?? null,
          linkKind: kind,
          settledAt: applied ? now : null,
          balanceAppliedAt: applied ? now : null,
        });
        mirrorId = mirror.id;
        if (applied) await r.accounts.adjustBalance(target.id, mirror.amountInCents);
      }
      await r.transactions.save({
        ...t,
        isInternalTransfer: true,
        internalTransferManual: true,
        linkedAccountId: target!.id,
        linkKind: kind,
      });
      return {
        linkedAccountId: target!.id as string | null,
        linkKind: kind as TransferLinkBody['kind'] | null,
        mirrorId,
      };
    });
  }

  private async removeMirror(
    r: Pick<Repositories, 'transactions' | 'accounts'>,
    mirror: Transaction,
    accounts: Account[],
  ) {
    const acc = mirror.accountId ? accounts.find((a) => a.id === mirror.accountId) : null;
    if (acc && isManualAccount(acc)) {
      const effect = balanceEffect(mirror);
      if (effect !== 0) await r.accounts.adjustBalance(acc.id, -effect);
    }
    await r.transactions.delete(mirror.id);
  }
}
