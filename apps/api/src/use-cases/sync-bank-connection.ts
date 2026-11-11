import type { BankGateway } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError, BankConnectionError } from '../domain/errors.js';
import { categorizeByRules } from '../services/categorize.js';
import { detectInternalTransfers } from '../services/internal-transfers.js';

const DAY = 24 * 60 * 60 * 1000;
const FIRST_SYNC_DAYS = 90; // primeira vez: puxa 3 meses
const OVERLAP_DAYS = 3; // depois: volta 3 dias, porque o banco às vezes lança atrasado

type Deps = Pick<Repositories, 'connections' | 'accounts' | 'transactions' | 'rules'> & { bank: BankGateway; now?: () => Date };

/**
 * Coração do app: puxa contas e transações do banco e guarda sem duplicar.
 *
 * 1. Atualiza contas (saldo).
 * 2. Busca transações da janela [desde, agora].
 * 3. Pula as que já existem (externalId).
 * 4. Categoriza as novas pelas regras.
 * 5. Recalcula transferências internas na janela inteira (um lado do par pode ter chegado antes).
 */
export class SyncBankConnectionUseCase {
  constructor(private readonly deps: Deps) {}

  async execute({ connectionId }: { connectionId: string }) {
    const { connections, accounts, transactions, rules, bank } = this.deps;
    const now = this.deps.now?.() ?? new Date();

    const connection = await connections.findById(connectionId);
    if (!connection) throw new ResourceNotFoundError('Conexão');

    const since = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt.getTime() - OVERLAP_DAYS * DAY)
      : new Date(now.getTime() - FIRST_SYNC_DAYS * DAY);

    try {
      const userRules = await rules.listForUser(connection.userId);
      const remoteAccounts = await bank.fetchAccounts(connection.itemId);
      let importedCount = 0;

      for (const remote of remoteAccounts) {
        const account = await accounts.upsertByExternalId({ ...remote, userId: connection.userId, connectionId: connection.id });
        const remoteTxs = await bank.fetchTransactions(remote.externalId, since, now);

        for (const tx of remoteTxs) {
          if (await transactions.findByExternalId(connection.userId, tx.externalId)) continue;
          await transactions.create({
            userId: connection.userId,
            accountId: account.id,
            externalId: tx.externalId,
            description: tx.description,
            amountInCents: tx.amountInCents,
            occurredAt: tx.occurredAt,
            categoryId: categorizeByRules(tx.description, userRules),
            isInternalTransfer: false,
          });
          importedCount++;
        }
      }

      const window = await transactions.findManyInRange(connection.userId, new Date(since.getTime() - DAY), new Date(now.getTime() + DAY));
      const internal = detectInternalTransfers(window);
      for (const t of window) {
        const shouldBe = internal.has(t.id);
        if (t.isInternalTransfer !== shouldBe && t.accountId) await transactions.save({ ...t, isInternalTransfer: shouldBe });
      }

      await connections.save({ ...connection, status: 'ACTIVE', lastSyncedAt: now });
      return { importedCount, accounts: remoteAccounts.length };
    } catch (err) {
      await connections.save({ ...connection, status: 'ERROR' });
      if (err instanceof BankConnectionError) throw err;
      throw new BankConnectionError();
    }
  }
}
