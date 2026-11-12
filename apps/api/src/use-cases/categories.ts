import type { Category } from '../domain/entities.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';

/** A pessoa pode usar as categorias do sistema e as que ela mesma criou. */
export function canUseCategory(category: Category | null, userId: string): category is Category {
  return !!category && (!category.userId || category.userId === userId);
}

/** Categoria "Não conta" vira transferência interna: some do gasto e da renda. */
export function isNeutral(categoryId: string | null) {
  return categoryId === NEUTRAL_CATEGORY_ID;
}

const MAX_CUSTOM = 30;

/** "Minhas categorias": a pessoa cria entradas e saídas do jeito dela (Mesada, Freela, Rolê...). */
export class CreateCategoryUseCase {
  constructor(private readonly repos: Pick<Repositories, 'categories'>) {}

  async execute({ userId, name, emoji, kind }: { userId: string; name: string; emoji: string; kind: 'saida' | 'entrada' }) {
    const all = await this.repos.categories.list(userId);
    const clean = name.trim();
    if (all.some((c) => c.name.toLowerCase() === clean.toLowerCase())) throw new AppError('Já tem uma categoria com esse nome.', 409);
    if (all.filter((c) => c.userId === userId).length >= MAX_CUSTOM) throw new AppError(`Dá pra criar até ${MAX_CUSTOM} categorias.`, 400);
    const color = kind === 'entrada' ? '#D8F7EC' : '#FFE3D6';
    const category = await this.repos.categories.create({ userId, name: clean, emoji: emoji.trim() || '🏷️', color, kind });
    return { category };
  }
}

/** Apaga uma categoria criada pela pessoa. As transações dela voltam pra "pendente". */
export class DeleteCategoryUseCase {
  constructor(private readonly repos: Pick<Repositories, 'categories' | 'transactions' | 'rules' | 'budgets'>) {}

  async execute({ userId, categoryId }: { userId: string; categoryId: string }) {
    const category = await this.repos.categories.findById(categoryId);
    if (!category || category.userId !== userId) throw new ResourceNotFoundError('Categoria');
    await this.repos.transactions.clearCategory(categoryId);
    await this.repos.rules.deleteByCategory(categoryId);
    await this.repos.budgets.deleteByCategory(categoryId);
    await this.repos.categories.delete(categoryId);
  }
}
