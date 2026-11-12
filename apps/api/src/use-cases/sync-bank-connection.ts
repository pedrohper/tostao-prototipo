import { isImportConnection } from './import-statement.js';
import type { BankGateway } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import type { BankConnection } from '../domain/entities.js';
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
    // Extrato importado de arquivo não tem provedor: atualiza subindo outro arquivo.
    if (isImportConnection(connection.itemId)) return { importedCount: 0, accounts: (await accounts.listByUser(connection.userId)).filter((a) => a.connectionId === connection.id).length };

    const since = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt.getTime() - OVERLAP_DAYS * DAY)
      : new Date(now.getTime() - FIRST_SYNC_DAYS * DAY);

    try {
      const userRules = await rules.listForUser(connection.userId);
      const remoteAccounts = await bank.fetchAccounts(connection.itemId);
      let importedCount = 0;

      let keptAccounts = 0;

      for (const remote of remoteAccounts) {
        const fingerprint = remote.fingerprint ?? null;
        if (fingerprint && (await this.belongsToOlderConnection(connection, fingerprint))) {
          // Mesmo cartão já vem de uma conexão mais antiga: ignora este e apaga a cópia, se ficou de um sync anterior.
          const copy = (await accounts.listByUser(connection.userId)).find((a) => a.externalId === remote.externalId);
          if (copy) await accounts.delete(copy.id);
          continue;
        }
        keptAccounts++;
        const account = await accounts.upsertByExternalId({ ...remote, fingerprint, userId: connection.userId, connectionId: connection.id });
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
      return { importedCount, accounts: keptAccounts };
    } catch (err) {
      await connections.save({ ...connection, status: 'ERROR' });
      if (err instanceof BankConnectionError) throw err;
      throw new BankConnectionError();
    }
  }

  /**
   * O mesmo cartão em duas conexões (ex.: Bradesco e Bradescard): fica com a conexão mais antiga.
   * Regra determinística, então não importa qual das duas sincroniza primeiro.
   */
  private async belongsToOlderConnection(connection: BankConnection, fingerprint: string) {
    const twins = (await this.deps.accounts.findByFingerprint(connection.userId, fingerprint)).filter((a) => a.connectionId !== connection.id);
    for (const twin of twins) {
      const owner = await this.deps.connections.findById(twin.connectionId);
      if (owner && (owner.createdAt < connection.createdAt || (owner.createdAt.getTime() === connection.createdAt.getTime() && owner.id < connection.id))) return true;
    }
    return false;
  }
}
