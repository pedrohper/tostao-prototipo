import type { Repositories } from '../repositories/types.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { categorizeByRules, patternFromDescription } from '../services/categorize.js';

type Input = { userId: string; transactionId: string; categoryId: string; remember: boolean };

/**
 * Coloca uma transação numa categoria.
 * Com remember=true cria uma regra do usuário e aplica nas outras pendentes iguais
 * ("toda vez que aparecer PAG*RESTAURANTESABOR é Delivery").
 */
export class CategorizeTransactionUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'categories' | 'rules'>) {}

  async execute({ userId, transactionId, categoryId, remember }: Input) {
    const { transactions, categories, rules } = this.repos;
    const tx = await transactions.findById(transactionId);
    // Transação de outro usuário = "não encontrada". Nunca revele que existe.
    if (!tx || tx.userId !== userId) throw new ResourceNotFoundError('Transação');
    if (!(await categories.findById(categoryId))) throw new ResourceNotFoundError('Categoria');

    await transactions.save({ ...tx, categoryId });
    let alsoUpdated = 0;

    if (remember) {
      const pattern = patternFromDescription(tx.description);
      if (pattern.length >= 3) {
        const rule = await rules.upsert({ userId, pattern, categoryId });
        for (const other of await transactions.findUncategorized(userId)) {
          if (other.id !== tx.id && categorizeByRules(other.description, [rule])) {
            await transactions.save({ ...other, categoryId });
            alsoUpdated++;
          }
        }
      }
    }
    return { alsoUpdated };
  }
}
