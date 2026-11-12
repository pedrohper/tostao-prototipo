import type { Repositories } from '../repositories/types.js';
import { AppError } from '../domain/errors.js';
import { categorizeByRules } from '../services/categorize.js';
import { detectInternalTransfers } from '../services/internal-transfers.js';
import { parseStatement, StatementParseError } from '../services/statement-parser.js';

const DAY = 24 * 60 * 60 * 1000;
export const IMPORT_PREFIX = 'import:';

export const isImportConnection = (itemId: string) => itemId.startsWith(IMPORT_PREFIX);

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

type Input = { userId: string; accountName: string; fileName: string; content: string; isCard?: boolean };

/**
 * Importar extrato (OFX/CSV) sem Pluggy. Cada nome de conta vira uma "conexão de importação"
 * com uma conta só; importar o mesmo arquivo de novo não duplica (externalId estável).
 */
export class ImportStatementUseCase {
  constructor(private readonly repos: Pick<Repositories, 'connections' | 'accounts' | 'transactions' | 'rules'>) {}

  async execute({ userId, accountName, fileName, content, isCard }: Input) {
    let parsed;
    try {
      parsed = parseStatement(content, fileName, { isCard });
    } catch (e) {
      if (e instanceof StatementParseError) throw new AppError(e.message, 400);
      throw e;
    }
    const name = accountName.trim() || (parsed.kind === 'CREDIT' ? 'Cartão importado' : 'Conta importada');
    const itemId = `${IMPORT_PREFIX}${slug(name) || 'conta'}`;
    const { connections, accounts, transactions, rules } = this.repos;

    let connection = await connections.findByUserAndItem(userId, itemId);
    if (!connection) connection = await connections.create({ userId, itemId, institution: name });
    const existing = (await accounts.listByUser(userId)).find((a) => a.connectionId === connection.id);
    const account = await accounts.upsertByExternalId({
      userId,
      connectionId: connection.id,
      externalId: `${itemId}:${userId}`,
      name,
      type: parsed.kind,
      // Saldo: o OFX costuma trazer; CSV não. Sem saldo novo, mantém o que já tinha.
      balanceInCents: parsed.balanceInCents ?? existing?.balanceInCents ?? 0,
      fingerprint: null,
    });

    const userRules = await rules.listForUser(userId);
    let importedCount = 0;
    let skipped = 0;
    for (const tx of parsed.transactions) {
      const externalId = `${connection.id}:${tx.externalId}`;
      if (await transactions.findByExternalId(userId, externalId)) { skipped++; continue; }
      await transactions.create({
        userId,
        accountId: account.id,
        externalId,
        description: tx.description,
        amountInCents: tx.amountInCents,
        occurredAt: tx.occurredAt,
        categoryId: categorizeByRules(tx.description, userRules),
        isInternalTransfer: false,
      });
      importedCount++;
    }

    // Pagamento de fatura, Pix entre contas suas etc. também valem pro que veio de arquivo.
    const times = parsed.transactions.map((t) => t.occurredAt.getTime());
    const window = await transactions.findManyInRange(userId, new Date(Math.min(...times) - 2 * DAY), new Date(Math.max(...times) + 2 * DAY));
    const internal = detectInternalTransfers(window);
    for (const t of window) {
      const shouldBe = internal.has(t.id);
      if (t.accountId && t.isInternalTransfer !== shouldBe) await transactions.save({ ...t, isInternalTransfer: shouldBe });
    }
    await connections.save({ ...connection, status: 'ACTIVE', lastSyncedAt: new Date() });

    const sorted = [...times].sort((a, b) => a - b);
    return {
      importedCount,
      skipped,
      format: parsed.format,
      kind: parsed.kind,
      accountName: name,
      from: new Date(sorted[0]!),
      to: new Date(sorted.at(-1)!),
    };
  }
}
