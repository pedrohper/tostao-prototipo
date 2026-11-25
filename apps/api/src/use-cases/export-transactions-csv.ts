import type { ExportCsvQuery } from '@tostao/contracts';
import { ResourceNotFoundError } from '../domain/errors.js';
import { addCivilDays, civilDay, safeTimezone, startOfCivilDay } from '../lib/tz.js';
import type { Repositories } from '../repositories/types.js';
import { transactionsCsv } from '../services/csv.js';

// Sem período, vai tudo: do começo até as parcelas futuras.
const BEGINNING = new Date(0);
const END_OF_TIME = new Date('9999-12-31T23:59:59.999Z');

/**
 * Os lançamentos da pessoa em planilha. Mesmas travas do export JSON: tudo filtrado pelo `userId` do token e um
 * `AuditLog` `data_exported` com contagem e período, nunca com o conteúdo.
 */
export class ExportTransactionsCsvUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'accounts' | 'categories' | 'transactions' | 'audit'>,
  ) {}

  async execute({
    userId,
    from,
    to,
    ipAddress,
    now = new Date(),
  }: { userId: string; ipAddress?: string | null; now?: Date } & ExportCsvQuery) {
    const user = await this.repos.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Conta');
    const tz = safeTimezone(user.timezone);
    const [transactions, accounts, categories] = await Promise.all([
      this.repos.transactions.findManyInRange(
        userId,
        from ? startOfCivilDay(from, tz) : BEGINNING,
        to ? startOfCivilDay(addCivilDays(to, 1), tz) : END_OF_TIME,
      ),
      this.repos.accounts.listByUser(userId),
      this.repos.categories.list(userId),
    ]);
    const accountName = new Map(accounts.filter((a) => a.userId === userId).map((a) => [a.id, a.name]));
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    const rows = transactions
      // Segunda trava, como no JSON: linha de outra pessoa não entra nem se o repositório errar.
      .filter((t) => t.userId === userId)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      .map((t) => ({
        day: civilDay(t.occurredAt, tz),
        description: t.customDescription?.trim() || t.description,
        category: (t.categoryId && categoryName.get(t.categoryId)) || 'Sem categoria',
        account: t.accountId ? (accountName.get(t.accountId) ?? '') : 'Anotado à mão',
        amountInCents: t.amountInCents,
      }));
    const csv = transactionsCsv(rows);

    await this.repos.audit.record({
      userId,
      action: 'data_exported',
      entityType: 'user',
      entityId: userId,
      ipAddress: ipAddress ?? null,
      metadata: { format: 'csv', transactions: rows.length, from: from ?? null, to: to ?? null },
    });

    const period = from || to ? `${from ?? 'inicio'}_a_${to ?? 'fim'}` : civilDay(now, tz);
    return { fileName: `tostao-lancamentos-${period}.csv`, csv };
  }
}
