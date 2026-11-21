import type { Repositories } from '../repositories/types.js';
import { AppError } from '../domain/errors.js';
import { categorizeByRules } from '../services/categorize.js';
import {
  applyInternalTransferUpdates,
  internalTransferUpdates,
  PAIR_WINDOW_DAYS,
} from '../services/internal-transfers.js';
import { parseStatement, StatementParseError, type SignConvention } from '../services/statement-parser.js';
import { reconcileManualEntries } from './reconcile-manual-entries.js';

const DAY = 24 * 60 * 60 * 1000;
export const IMPORT_PREFIX = 'import:';
export const MANUAL_PREFIX = 'manual:';

export const isImportConnection = (itemId: string) =>
  itemId.startsWith(IMPORT_PREFIX) || itemId.startsWith(MANUAL_PREFIX);

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

type Input = {
  userId: string;
  accountName: string;
  fileName: string;
  content: string;
  isCard?: boolean;
  signConvention?: SignConvention;
};

/**
 * Importar extrato (OFX/CSV) sem Pluggy. Cada nome de conta vira uma "conexão de importação"
 * com uma conta só; importar o mesmo arquivo de novo não duplica (externalId estável).
 */
export class ImportStatementUseCase {
  constructor(
    private readonly repos: Pick<
      Repositories,
      'connections' | 'accounts' | 'transactions' | 'rules' | 'reconciledNotes' | 'tx'
    >,
  ) {}

  async execute({ userId, accountName, fileName, content, isCard, signConvention }: Input) {
    // Lê e valida o arquivo ANTES de criar conexão ou conta: arquivo sem transação nenhuma não deixa conta vazia pra trás.
    let parsed;
    try {
      parsed = parseStatement(content, fileName, { isCard, signConvention });
    } catch (e) {
      if (e instanceof StatementParseError) throw new AppError(e.message, 400);
      throw e;
    }
    const name = accountName.trim() || (parsed.kind === 'CREDIT' ? 'Cartão importado' : 'Conta importada');
    const itemId = `${IMPORT_PREFIX}${slug(name) || 'conta'}`;
    const { connections, accounts, transactions, rules } = this.repos;

    let connection = await connections.findByUserAndItem(userId, itemId);
    if (!connection) connection = await connections.create({ userId, itemId, institution: name });
    // Contas lidas UMA vez: servem pra achar a desta importação agora e pras ocultas na conciliação, mais abaixo.
    const knownAccounts = await accounts.listByUser(userId);
    const existing = knownAccounts.find((a) => a.connectionId === connection.id);
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
    // Quem já foi importado vem numa query; o resto entra em INSERT em lote que pula duplicata (importar o mesmo arquivo
    // de novo, ou duas vezes ao mesmo tempo, não duplica). Antes: 2 consultas por linha do extrato.
    const rows = parsed.transactions.map((tx) => ({ tx, externalId: `${connection.id}:${tx.externalId}` }));
    const already = new Set(
      (
        await transactions.findByExternalIds(
          userId,
          rows.map((r) => r.externalId),
        )
      ).map((t) => t.externalId),
    );
    const importedCount = await transactions.createMany(
      rows
        .filter((r) => !already.has(r.externalId))
        .map(({ tx, externalId }) => ({
          userId,
          accountId: account.id,
          externalId,
          description: tx.description,
          amountInCents: tx.amountInCents,
          occurredAt: tx.occurredAt,
          categoryId: categorizeByRules(tx.description, userRules),
          isInternalTransfer: false,
          seriesId: null,
        })),
      { skipDuplicates: true },
    );
    const skipped = rows.length - importedCount;

    // Pagamento de fatura, Pix entre contas suas etc. também valem pro que veio de arquivo.
    const sorted = parsed.transactions.map((t) => t.occurredAt.getTime()).sort((a, b) => a - b);
    const firstTime = sorted[0]!;
    const lastTime = sorted.at(-1)!;
    // Janela com 3 dias de folga (compensação de boleto/TED). O que é par e ficou na borda não é desmarcado, e o que a
    // pessoa marcou/desmarcou à mão (internalTransferManual) nunca é reclassificado.
    const windowFrom = new Date(firstTime - PAIR_WINDOW_DAYS * DAY);
    const windowTo = new Date(lastTime + PAIR_WINDOW_DAYS * DAY);
    const window = await transactions.findManyInRange(userId, windowFrom, windowTo);
    await applyInternalTransferUpdates(
      transactions,
      userId,
      internalTransferUpdates(window, { from: windowFrom, to: windowTo }),
    );
    // Anotações à mão que o extrato acabou de confirmar saem (par 1 pra 1).
    const hidden = new Set(knownAccounts.filter((a) => a.hidden).map((a) => a.id));
    const { removedCount: reconciledCount } = await reconcileManualEntries(
      this.repos,
      userId,
      { from: new Date(firstTime), to: new Date(lastTime) },
      hidden,
    );
    await connections.save({ ...connection, status: 'ACTIVE', lastSyncedAt: new Date() });

    return {
      importedCount,
      skipped,
      reconciledCount,
      format: parsed.format,
      kind: parsed.kind,
      accountName: name,
      from: new Date(firstTime),
      to: new Date(lastTime),
    };
  }
}
