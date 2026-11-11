import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { patternFromDescription } from '../services/categorize.js';

export class GetTransactionUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts'>) {}

  async execute({ userId, transactionId }: { userId: string; transactionId: string }) {
    const t = await this.repos.transactions.findById(transactionId);
    if (!t || t.userId !== userId) throw new ResourceNotFoundError('Transação');
    const category = t.categoryId ? await this.repos.categories.findById(t.categoryId) : null;
    const account = t.accountId ? (await this.repos.accounts.listByUser(userId)).find((a) => a.id === t.accountId) : null;
    return {
      transaction: { ...t, categoryName: category?.name ?? null, accountName: account?.name ?? null },
      // O padrão que vira regra se o usuário marcar "sempre"
      rulePattern: patternFromDescription(t.description),
    };
  }
}
