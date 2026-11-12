import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { categorizeByRules } from '../services/categorize.js';
import { canUseCategory, isNeutral } from './categories.js';

type Input = {
  userId: string;
  description: string;
  amountInCents: number; // sempre positivo; o "kind" decide o sinal
  kind: 'saida' | 'entrada';
  occurredAt: Date;
  categoryId?: string | null;
  accountId?: string | null;
};

/** "Anotar gasto": pra dinheiro vivo ou pra quem não conectou banco. */
export class CreateManualTransactionUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'rules' | 'accounts'>) {}

  async execute(input: Input) {
    const { transactions, categories, rules } = this.repos;
    let categoryId = input.categoryId ?? null;
    if (categoryId && !canUseCategory(await categories.findById(categoryId), input.userId)) throw new ResourceNotFoundError('Categoria');
    const accountId = input.accountId ?? null;
    if (accountId && !(await this.repos.accounts.listByUser(input.userId)).some((a) => a.id === accountId)) throw new ResourceNotFoundError('Conta');
    if (!categoryId) categoryId = categorizeByRules(input.description, await rules.listForUser(input.userId));

    const transaction = await transactions.create({
      userId: input.userId,
      accountId,
      externalId: null,
      description: input.description,
      amountInCents: input.kind === 'saida' ? -Math.abs(input.amountInCents) : Math.abs(input.amountInCents),
      occurredAt: input.occurredAt,
      categoryId,
      isInternalTransfer: isNeutral(categoryId),
    });
    return { transaction };
  }
}
