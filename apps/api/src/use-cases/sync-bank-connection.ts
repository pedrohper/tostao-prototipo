import { isImportConnection } from './import-statement.js';
import type { BankAccountData, BankGateway, BankTransactionData } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import type { BankConnection } from '../domain/entities.js';
import { ResourceNotFoundError, BankConnectionError } from '../domain/errors.js';
import { categorizeByProviderCategory, categorizeByRules } from '../services/categorize.js';
import {
  applyInternalTransferUpdates,
  internalTransferUpdates,
  PAIR_WINDOW_DAYS,
} from '../services/internal-transfers.js';
import { endOfCivilDay } from '../lib/tz.js';
import { timezoneOf } from '../lib/user-tz.js';
import { isGenericInstitution } from '../services/bank-names.js';
import { nextDueDate } from './get-month-summary.js';
import { reconcileManualEntries, SYNC_LOOKBACK_DAYS } from './reconcile-manual-entries.js';

const DAY = 24 * 60 * 60 * 1000;
const FIRST_SYNC_DAYS = 90; // primeira vez: puxa 3 meses
const OVERLAP_DAYS = 3; // depois: volta 3 dias, porque o banco às vezes lança atrasado
const FUTURE_DAYS = 400; // cartão: parcelas futuras vêm com data lá na frente
const CARD_BACK_DAYS = 45;

/** Falhas seguidas do sync até pedir pra pessoa reconectar o banco. */
export const MAX_SYNC_FAILURES = 3;

type Deps = Pick<
  Repositories,
  'connections' | 'accounts' | 'transactions' | 'rules' | 'reconciledNotes' | 'tx' | 'users'
> & {
  bank: BankGateway;
  now?: () => Date;
};

/**
 * Coração do app: puxa contas e transações do banco e guarda sem duplicar.
 *
 * 1. Atualiza contas (saldo).
 * 2. Busca transações da janela [desde, agora].
 * 3. Pula as que já existem (externalId).
 * 4. Categoriza as novas pelas regras.
 * 5. Recalcula transferências internas na janela inteira (um lado do par pode ter chegado antes).
 * 6. Apaga anotações à mão que o banco acabou de confirmar (par 1 pra 1: mesmo valor, data próxima, texto parecido).
 */
export class SyncBankConnectionUseCase {
  constructor(private readonly deps: Deps) {}

  async execute({ connectionId }: { connectionId: string }) {
    const { connections, accounts, transactions, rules, bank } = this.deps;
    const now = this.deps.now?.() ?? new Date();

    const connection = await connections.findById(connectionId);
    if (!connection) throw new ResourceNotFoundError('Conexão');
    // Extrato importado de arquivo não tem provedor: atualiza subindo outro arquivo.
    if (isImportConnection(connection.itemId))
      return {
        importedCount: 0,
        accounts: (await accounts.listByUser(connection.userId)).filter((a) => a.connectionId === connection.id).length,
      };

    const since = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt.getTime() - OVERLAP_DAYS * DAY)
      : new Date(now.getTime() - FIRST_SYNC_DAYS * DAY);

    const tz = await timezoneOf(this.deps.users, connection.userId);
    try {
      // Tudo que o loop consulta várias vezes é lido UMA vez aqui (contas e conexões da pessoa, regras de categoria).
      const [userRules, remoteAccounts, knownAccounts, knownConnections] = await Promise.all([
        rules.listForUser(connection.userId),
        bank.fetchAccounts(connection.itemId),
        accounts.listByUser(connection.userId),
        connections.listByUser(connection.userId),
      ]);
      const connectionById = new Map(knownConnections.map((c) => [c.id, c]));
      let importedCount = 0;

      let keptAccounts = 0;

      for (const remote of remoteAccounts) {
        const fingerprint = remote.fingerprint ?? null;
        if (fingerprint && belongsToOlderConnection(connection, fingerprint, knownAccounts, connectionById)) {
          // Mesmo cartão já vem de uma conexão mais antiga: ignora este e apaga a cópia, se ficou de um sync anterior.
          const copy = knownAccounts.find((a) => a.externalId === remote.externalId);
          if (copy) {
            // A FK é SET NULL: sem apagar os lançamentos do banco dessa cópia antes, eles ficariam soltos (duplicados).
            await this.deps.tx(async (r) => {
              await r.transactions.deleteBankByAccount(connection.userId, copy.id);
              await r.accounts.delete(copy.id);
            });
          }
          continue;
        }
        keptAccounts++;
        const isCard = remote.type === 'CREDIT';
        // Cartão: busca ~45 dias pra trás (pra cobrir a fatura aberta inteira) e o futuro (parcelas).
        const from = isCard ? new Date(Math.min(since.getTime(), now.getTime() - CARD_BACK_DAYS * DAY)) : since;
        const fetched = await bank.fetchTransactions(
          remote.externalId,
          from,
          isCard ? new Date(now.getTime() + FUTURE_DAYS * DAY) : now,
        );
        // Parcela que ainda vai cair não é gasto de hoje: fica fora do histórico. Lançamento que o banco só deu o DIA
        // (sem hora) vale até o fim do dia civil: antes das 12h de Brasília ele ficaria "no futuro" e sumia.
        const endOfToday = endOfCivilDay(now, tz);
        const remoteTxs = fetched.filter((t) => t.occurredAt <= (t.dateOnly ? endOfToday : now));
        const { institution: _bank, ...data } = remote;
        const account = await accounts.upsertByExternalId({
          ...data,
          balanceInCents: isCard ? openBill(remote, fetched, now, tz) : remote.balanceInCents,
          fingerprint,
          userId: connection.userId,
          connectionId: connection.id,
        });

        // Os que já existem vêm numa query só; os novos entram num INSERT em lote (pula duplicata, então uma corrida
        // entre dois syncs não estoura nem duplica). Antes: 2 consultas por lançamento.
        const existingBy = new Map(
          (
            await transactions.findByExternalIds(
              connection.userId,
              remoteTxs.map((t) => t.externalId),
            )
          ).map((e) => [e.externalId, e]),
        );
        const fresh: Parameters<typeof transactions.createMany>[0] = [];
        const seen = new Set<string>();
        for (const tx of remoteTxs) {
          const existing = existingBy.get(tx.externalId);
          if (existing) {
            // O banco corrigiu o valor (ex.: compra em dólar que antes entrou em USD): acompanha.
            if (existing.amountInCents !== tx.amountInCents)
              await transactions.save({ ...existing, amountInCents: tx.amountInCents });
            continue;
          }
          if (seen.has(tx.externalId)) continue; // o banco mandou o mesmo lançamento duas vezes na mesma resposta
          seen.add(tx.externalId);
          fresh.push({
            userId: connection.userId,
            accountId: account.id,
            externalId: tx.externalId,
            description: tx.description,
            amountInCents: tx.amountInCents,
            occurredAt: tx.occurredAt,
            categoryId:
              categorizeByRules(tx.description, userRules, tx.merchantName) ??
              categorizeByProviderCategory(tx.providerCategory, tx.amountInCents),
            isInternalTransfer: false,
          });
        }
        importedCount += await transactions.createMany(fresh, { skipDuplicates: true });
      }

      // Janela da detecção: cobre o cartão (CARD_BACK_DAYS) e mais 3 dias de cada lado (compensação de boleto/TED).
      // Lado de par que ficou na borda não é desmarcado (o outro lado pode estar fora da janela).
      const windowFrom = new Date(
        Math.min(since.getTime(), now.getTime() - CARD_BACK_DAYS * DAY) - PAIR_WINDOW_DAYS * DAY,
      );
      const windowTo = new Date(now.getTime() + PAIR_WINDOW_DAYS * DAY);
      const window = await transactions.findManyInRange(connection.userId, windowFrom, windowTo);
      await applyInternalTransferUpdates(
        transactions,
        connection.userId,
        internalTransferUpdates(window, { from: windowFrom, to: windowTo }),
      );

      // Limpeza opcional: se falhar, a importação já feita vale e a conexão continua saudável.
      let reconciledCount = 0;
      try {
        const hidden = new Set(knownAccounts.filter((a) => a.hidden).map((a) => a.id));
        ({ removedCount: reconciledCount } = await reconcileManualEntries(
          this.deps,
          connection.userId,
          { from: new Date(now.getTime() - SYNC_LOOKBACK_DAYS * DAY), to: now },
          hidden,
        ));
      } catch (err) {
        console.error('[sync] reconciliação de anotações falhou:', (err as Error).message);
      }

      // Pelo MeuPluggy o Item não diz o banco: usa o que as contas revelaram.
      const institution = isGenericInstitution(connection.institution)
        ? (remoteAccounts.map((a) => a.institution).find(Boolean) ?? connection.institution)
        : connection.institution;
      // Sucesso: zera a contagem de falhas.
      await connections.save({
        ...connection,
        institution,
        status: 'ACTIVE',
        lastSyncedAt: now,
        errorCount: 0,
        lastErrorAt: null,
      });
      return { importedCount, accounts: keptAccounts, reconciledCount };
    } catch (err) {
      // Falha: ERROR e uma nova tentativa a cada 24 h (jobs/daily-sync). Na 3ª falha seguida o banco precisa ser reconectado.
      const errorCount = connection.errorCount + 1;
      await connections.save({
        ...connection,
        status: errorCount >= MAX_SYNC_FAILURES ? 'RECONNECT_REQUIRED' : 'ERROR',
        errorCount,
        lastErrorAt: now,
      });
      if (err instanceof BankConnectionError) throw err;
      throw new BankConnectionError();
    }
  }
}

/**
 * O mesmo cartão em duas conexões (ex.: Bradesco e Bradescard): fica com a conexão mais antiga.
 * Regra determinística, então não importa qual das duas sincroniza primeiro. Usa as contas e conexões já carregadas.
 */
function belongsToOlderConnection(
  connection: BankConnection,
  fingerprint: string,
  accounts: { connectionId: string; fingerprint: string | null }[],
  connectionById: ReadonlyMap<string, BankConnection>,
) {
  const twins = accounts.filter((a) => a.fingerprint === fingerprint && a.connectionId !== connection.id);
  for (const twin of twins) {
    const owner = connectionById.get(twin.connectionId);
    if (
      owner &&
      (owner.createdAt < connection.createdAt ||
        (owner.createdAt.getTime() === connection.createdAt.getTime() && owner.id < connection.id))
    )
      return true;
  }
  return false;
}

const PAYMENT = /pagamento (recebido|de fatura|da fatura)|pgto fatura|pagto fatura/i;

/**
 * Fatura aberta do cartão (negativo = deve).
 * - Nubank (marca a fatura de cada transação com billId): soma o que ainda não tem fatura,
 *   até hoje, sem os pagamentos. É o número que aparece no app do banco.
 * - Sem essa marcação: o "balance" é o limite usado; tira as parcelas que caem depois do fechamento estimado.
 */
export function openBill(
  remote: Pick<BankAccountData, 'balanceInCents' | 'dueDate' | 'institution'>,
  fetched: BankTransactionData[],
  now: Date,
  tz?: string,
) {
  // Date-only vale até o fim do dia civil (ver o filtro do sync); com hora, vale até agora.
  const endOfToday = endOfCivilDay(now, tz);
  const notFuture = (t: BankTransactionData) => t.occurredAt <= (t.dateOnly ? endOfToday : now);
  // Só o Nubank deixa as compras da fatura aberta sem billId (conferido com o app dele).
  // Mercado Pago e Bradescard usam billId de outro jeito: lá o balance menos as parcelas futuras é que bate.
  if (remote.institution === 'Nubank' && fetched.some((t) => t.billId)) {
    const open = fetched.filter((t) => !t.billId && notFuture(t) && !PAYMENT.test(t.description));
    return Math.min(
      0,
      open.reduce((s, t) => s + t.amountInCents, 0),
    );
  }
  const closing = remote.dueDate ? new Date(nextDueDate(remote.dueDate, now).getTime() - 7 * DAY) : now;
  const cutoff = closing > now ? closing : now;
  const futureOwed = Math.max(
    0,
    -fetched.filter((t) => t.occurredAt > cutoff).reduce((s, t) => s + t.amountInCents, 0),
  );
  return Math.min(0, remote.balanceInCents + futureOwed);
}
