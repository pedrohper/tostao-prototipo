// Repositórios em memória: arrays simples. Usados nos testes e pra rodar sem Postgres.
import { randomUUID } from 'node:crypto';
import type { Account, BankConnection, Category, CategoryBudget, CategoryRule, LessonProgress, Transaction, User } from '../../domain/entities.js';
import type {
  AccountsRepository, BankConnectionsRepository, BudgetsRepository, CategoriesRepository, CategoryRulesRepository, IgnoredSubscriptionsRepository, LessonProgressRepository,
  Repositories, TransactionsRepository, UsersRepository,
} from '../types.js';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../../lib/defaults.js';

export class InMemoryUsersRepository implements UsersRepository {
  items: User[] = [];
  async findByEmail(email: string) { return this.items.find((u) => u.email === email) ?? null; }
  async findById(id: string) { return this.items.find((u) => u.id === id) ?? null; }
  async create(data: Pick<User, 'name' | 'email' | 'passwordHash'>) {
    const user: User = { id: randomUUID(), createdAt: new Date(), ...data };
    this.items.push(user);
    return user;
  }
}

export class InMemoryBankConnectionsRepository implements BankConnectionsRepository {
  items: BankConnection[] = [];
  // Imita o onDelete: Cascade do Postgres
  constructor(private readonly cascade?: { accounts: InMemoryAccountsRepository; transactions: InMemoryTransactionsRepository }) {}
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async findByUserAndItem(userId: string, itemId: string) {
    return this.items.find((c) => c.userId === userId && c.itemId === itemId) ?? null;
  }
  async listByUser(userId: string) { return this.items.filter((c) => c.userId === userId); }
  async listActive() { return this.items.filter((c) => c.status === 'ACTIVE'); }
  async create(data: Pick<BankConnection, 'userId' | 'itemId' | 'institution'>) {
    const c: BankConnection = { id: randomUUID(), status: 'ACTIVE', lastSyncedAt: null, createdAt: new Date(), ...data };
    this.items.push(c);
    return c;
  }
  async save(connection: BankConnection) {
    const i = this.items.findIndex((c) => c.id === connection.id);
    if (i >= 0) this.items[i] = connection;
  }
  async delete(id: string) {
    this.items = this.items.filter((c) => c.id !== id);
    if (!this.cascade) return;
    const gone = new Set(this.cascade.accounts.items.filter((a) => a.connectionId === id).map((a) => a.id));
    this.cascade.accounts.items = this.cascade.accounts.items.filter((a) => !gone.has(a.id));
    this.cascade.transactions.items = this.cascade.transactions.items.filter((t) => !t.accountId || !gone.has(t.accountId));
  }
}

export class InMemoryAccountsRepository implements AccountsRepository {
  items: Account[] = [];
  constructor(private readonly transactions?: InMemoryTransactionsRepository) {}
  async findByFingerprint(userId: string, fingerprint: string) {
    return this.items.filter((a) => a.userId === userId && a.fingerprint === fingerprint);
  }
  async delete(id: string) {
    this.items = this.items.filter((a) => a.id !== id);
    if (this.transactions) this.transactions.items = this.transactions.items.filter((t) => t.accountId !== id);
  }
  async upsertByExternalId(data: Omit<Account, 'id'>) {
    const found = this.items.find((a) => a.userId === data.userId && a.externalId === data.externalId);
    if (found) { Object.assign(found, data); return found; }
    const a: Account = { id: randomUUID(), ...data };
    this.items.push(a);
    return a;
  }
  async listByUser(userId: string) { return this.items.filter((a) => a.userId === userId); }
}

export class InMemoryCategoriesRepository implements CategoriesRepository {
  items: Category[] = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  async list() { return this.items; }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
}

export class InMemoryCategoryRulesRepository implements CategoryRulesRepository {
  items: CategoryRule[] = DEFAULT_RULES.map((r) => ({ id: randomUUID(), userId: null, ...r }));
  async listForUser(userId: string) { return this.items.filter((r) => r.userId === null || r.userId === userId); }
  async upsert(data: Omit<CategoryRule, 'id'>) {
    const found = this.items.find((r) => r.userId === data.userId && r.pattern === data.pattern);
    if (found) { found.categoryId = data.categoryId; return found; }
    const r: CategoryRule = { id: randomUUID(), ...data };
    this.items.push(r);
    return r;
  }
}

export class InMemoryTransactionsRepository implements TransactionsRepository {
  items: Transaction[] = [];
  async findById(id: string) { return this.items.find((t) => t.id === id) ?? null; }
  async findByExternalId(userId: string, externalId: string) {
    return this.items.find((t) => t.userId === userId && t.externalId === externalId) ?? null;
  }
  async findManyInRange(userId: string, from: Date, to: Date) {
    return this.items
      .filter((t) => t.userId === userId && t.occurredAt >= from && t.occurredAt < to)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
  async findUncategorized(userId: string) {
    return this.items.filter((t) => t.userId === userId && t.categoryId === null && !t.isInternalTransfer);
  }
  async create(data: Omit<Transaction, 'id' | 'createdAt'>) {
    const t: Transaction = { id: randomUUID(), createdAt: new Date(), ...data };
    this.items.push(t);
    return t;
  }
  async save(transaction: Transaction) {
    const i = this.items.findIndex((t) => t.id === transaction.id);
    if (i >= 0) this.items[i] = transaction;
  }
}

export class InMemoryBudgetsRepository implements BudgetsRepository {
  items: CategoryBudget[] = [];
  async listByUser(userId: string) { return this.items.filter((b) => b.userId === userId); }
  async upsert(data: Omit<CategoryBudget, 'id'>) {
    const found = this.items.find((b) => b.userId === data.userId && b.categoryId === data.categoryId);
    if (found) { found.limitInCents = data.limitInCents; return found; }
    const b: CategoryBudget = { id: randomUUID(), ...data };
    this.items.push(b);
    return b;
  }
  async delete(userId: string, categoryId: string) { this.items = this.items.filter((b) => !(b.userId === userId && b.categoryId === categoryId)); }
}

export class InMemoryLessonProgressRepository implements LessonProgressRepository {
  items: LessonProgress[] = [];
  async listByUser(userId: string) { return this.items.filter((l) => l.userId === userId); }
  async markDone(userId: string, lessonId: string) {
    if (!this.items.some((l) => l.userId === userId && l.lessonId === lessonId)) this.items.push({ userId, lessonId, completedAt: new Date() });
  }
}

export class InMemoryIgnoredSubscriptionsRepository implements IgnoredSubscriptionsRepository {
  items: { userId: string; key: string }[] = [];
  async listKeys(userId: string) { return this.items.filter((i) => i.userId === userId).map((i) => i.key); }
  async set(userId: string, key: string, ignored: boolean) {
    this.items = this.items.filter((i) => !(i.userId === userId && i.key === key));
    if (ignored) this.items.push({ userId, key });
  }
}

export function makeInMemoryRepositories() {
  const transactions = new InMemoryTransactionsRepository();
  const accounts = new InMemoryAccountsRepository(transactions);
  return {
    users: new InMemoryUsersRepository(),
    connections: new InMemoryBankConnectionsRepository({ accounts, transactions }),
    accounts,
    categories: new InMemoryCategoriesRepository(),
    rules: new InMemoryCategoryRulesRepository(),
    transactions,
    budgets: new InMemoryBudgetsRepository(),
    lessons: new InMemoryLessonProgressRepository(),
    ignoredSubscriptions: new InMemoryIgnoredSubscriptionsRepository(),
  } satisfies Repositories;
}
