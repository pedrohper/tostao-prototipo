import { isImportConnection } from './import-statement.js';
import type { BankAccountData, BankGateway, BankTransactionData } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import type { BankConnection } from '../domain/entities.js';
import { ResourceNotFoundError, BankConnectionError } from '../domain/errors.js';
import { categorizeByRules } from '../services/categorize.js';
import { detectInternalTransfers } from '../services/internal-transfers.js';
import { isGenericInstitution } from '../services/bank-names.js';
import { nextDueDate } from './get-month-summary.js';

const DAY = 24 * 60 * 60 * 1000;
const FIRST_SYNC_DAYS = 90; // primeira vez: puxa 3 meses
const OVERLAP_DAYS = 3; // depois: volta 3 dias, porque o banco às vezes lança atrasado
const FUTURE_DAYS = 400; // cartão: parcelas futuras vêm com data lá na frente
const CARD_BACK_DAYS = 45;

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
        const isCard = remote.type === 'CREDIT';
        // Cartão: busca ~45 dias pra trás (pra cobrir a fatura aberta inteira) e o futuro (parcelas).
        const from = isCard ? new Date(Math.min(since.getTime(), now.getTime() - CARD_BACK_DAYS * DAY)) : since;
        const fetched = await bank.fetchTransactions(remote.externalId, from, isCard ? new Date(now.getTime() + FUTURE_DAYS * DAY) : now);
        // Parcela que ainda vai cair não é gasto de hoje: fica fora do histórico.
        const remoteTxs = fetched.filter((t) => t.occurredAt <= now);
        const { institution: _bank, ...data } = remote;
        const account = await accounts.upsertByExternalId({
          ...data,
          balanceInCents: isCard ? openBill(remote, fetched, now) : remote.balanceInCents,
          fingerprint, userId: connection.userId, connectionId: connection.id,
        });

        for (const tx of remoteTxs) {
          const existing = await transactions.findByExternalId(connection.userId, tx.externalId);
          if (existing) {
            // O banco corrigiu o valor (ex.: compra em dólar que antes entrou em USD): acompanha.
            if (existing.amountInCents !== tx.amountInCents) await transactions.save({ ...existing, amountInCents: tx.amountInCents });
            continue;
          }
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

      // Pelo MeuPluggy o Item não diz o banco: usa o que as contas revelaram.
      const institution = isGenericInstitution(connection.institution)
        ? remoteAccounts.map((a) => a.institution).find(Boolean) ?? connection.institution
        : connection.institution;
      await connections.save({ ...connection, institution, status: 'ACTIVE', lastSyncedAt: now });
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

const PAYMENT = /pagamento (recebido|de fatura|da fatura)|pgto fatura|pagto fatura/i;

/**
 * Fatura aberta do cartão (negativo = deve).
 * - Nubank (marca a fatura de cada transação com billId): soma o que ainda não tem fatura,
 *   até hoje, sem os pagamentos. É o número que aparece no app do banco.
 * - Sem essa marcação: o "balance" é o limite usado; tira as parcelas que caem depois do fechamento estimado.
 */
export function openBill(remote: Pick<BankAccountData, 'balanceInCents' | 'dueDate' | 'institution'>, fetched: BankTransactionData[], now: Date) {
  // Só o Nubank deixa as compras da fatura aberta sem billId (conferido com o app dele).
  // Mercado Pago e Bradescard usam billId de outro jeito: lá o balance menos as parcelas futuras é que bate.
  if (remote.institution === 'Nubank' && fetched.some((t) => t.billId)) {
    const open = fetched.filter((t) => !t.billId && t.occurredAt <= now && !PAYMENT.test(t.description));
    return Math.min(0, open.reduce((s, t) => s + t.amountInCents, 0));
  }
  const closing = remote.dueDate ? new Date(nextDueDate(remote.dueDate, now).getTime() - 7 * DAY) : now;
  const cutoff = closing > now ? closing : now;
  const futureOwed = Math.max(0, -fetched.filter((t) => t.occurredAt > cutoff).reduce((s, t) => s + t.amountInCents, 0));
  return Math.min(0, remote.balanceInCents + futureOwed);
}
