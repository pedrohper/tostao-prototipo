// Repositórios em memória: arrays simples. Usados nos testes e pra rodar sem Postgres.
import { randomUUID } from 'node:crypto';
import type { Account, BankConnection, Category, CategoryBudget, CategoryRule, LessonProgress, Transaction, User, Invite, PasswordReset, ChatMessage } from '../../domain/entities.js';
import type { FinancialPlan } from '@tostao/contracts';
import type {
  AccountData, AccountsRepository, FinancialPlansRepository, BankConnectionsRepository, BudgetsRepository, CategoriesRepository, CategoryRulesRepository, ChatMessagesRepository, IgnoredSubscriptionsRepository, InvitesRepository, LessonProgressRepository, PasswordResetsRepository,
  Repositories, TransactionsRepository, UsersRepository, WhatsappLink, WhatsappLinksRepository,
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
  async count() { return this.items.length; }
  async updatePassword(id: string, passwordHash: string) {
    const u = this.items.find((x) => x.id === id);
    if (u) u.passwordHash = passwordHash;
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
  async setHidden(id: string, hidden: boolean) {
    const a = this.items.find((x) => x.id === id);
    if (a) a.hidden = hidden;
  }
  async upsertByExternalId(data: AccountData) {
    const found = this.items.find((a) => a.userId === data.userId && a.externalId === data.externalId);
    if (found) { Object.assign(found, data); return found; }
    const a: Account = { id: randomUUID(), hidden: false, creditLimitInCents: null, dueDate: null, ...data };
    this.items.push(a);
    return a;
  }
  async listByUser(userId: string) { return this.items.filter((a) => a.userId === userId); }
}

export class InMemoryCategoriesRepository implements CategoriesRepository {
  items: Category[] = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  async list(userId?: string) { return this.items.filter((c) => !c.userId || c.userId === userId); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async create(data: Omit<Category, 'id'> & { userId: string }) {
    const c: Category = { id: `u-${randomUUID()}`, ...data };
    this.items.push(c);
    return c;
  }
  async delete(id: string) { this.items = this.items.filter((c) => c.id !== id); }
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
  async deleteByCategory(categoryId: string) { this.items = this.items.filter((r) => r.categoryId !== categoryId); }
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
  async clearCategory(categoryId: string) { for (const t of this.items) if (t.categoryId === categoryId) t.categoryId = null; }
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
  async deleteByCategory(categoryId: string) { this.items = this.items.filter((b) => b.categoryId !== categoryId); }
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

export class InMemoryInvitesRepository implements InvitesRepository {
  items: Invite[] = [];
  async create(data: { code: string; createdById: string }) {
    const i: Invite = { ...data, usedById: null, createdAt: new Date(), usedAt: null };
    this.items.push(i);
    return i;
  }
  async findByCode(code: string) { return this.items.find((i) => i.code === code) ?? null; }
  async markUsed(code: string, userId: string) {
    const i = this.items.find((x) => x.code === code);
    if (i) Object.assign(i, { usedById: userId, usedAt: new Date() });
  }
  async listByCreator(userId: string) { return this.items.filter((i) => i.createdById === userId).reverse(); }
}

export class InMemoryPasswordResetsRepository implements PasswordResetsRepository {
  items: PasswordReset[] = [];
  async create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
    const r: PasswordReset = { id: randomUUID(), usedAt: null, ...data };
    this.items.push(r);
    return r;
  }
  async findByTokenHash(tokenHash: string) { return this.items.find((r) => r.tokenHash === tokenHash) ?? null; }
  async markUsed(id: string) {
    const r = this.items.find((x) => x.id === id);
    if (r) r.usedAt = new Date();
  }
}

export class InMemoryChatMessagesRepository implements ChatMessagesRepository {
  items: ChatMessage[] = [];
  async listRecent(userId: string, limit: number) { return this.items.filter((m) => m.userId === userId).slice(-limit); }
  async create(data: Omit<ChatMessage, 'id' | 'createdAt'>) {
    const m: ChatMessage = { id: randomUUID(), createdAt: new Date(), ...data };
    this.items.push(m);
    return m;
  }
  async countUserSince(userId: string, since: Date) { return this.items.filter((m) => m.userId === userId && m.role === 'user' && m.createdAt >= since).length; }
}

export class InMemoryFinancialPlansRepository implements FinancialPlansRepository {
  items = new Map<string, FinancialPlan>();
  async get(userId: string) { return this.items.get(userId) ?? null; }
  async save(userId: string, plan: FinancialPlan) { this.items.set(userId, plan); }
}

export class InMemoryWhatsappLinksRepository implements WhatsappLinksRepository {
  items = new Map<string, WhatsappLink>();
  private row(userId: string) { return this.items.get(userId) ?? { userId, phone: null, code: null, codeExpiresAt: null, linkedAt: null }; }
  async get(userId: string) { return this.items.get(userId) ?? null; }
  async findByPhone(phone: string) { return [...this.items.values()].find((l) => l.phone === phone) ?? null; }
  async findByCode(code: string) { return [...this.items.values()].find((l) => l.code === code) ?? null; }
  async setCode(userId: string, code: string, expiresAt: Date) { this.items.set(userId, { ...this.row(userId), code, codeExpiresAt: expiresAt }); }
  async link(userId: string, phone: string, at: Date) {
    for (const l of this.items.values()) if (l.phone === phone && l.userId !== userId) this.items.set(l.userId, { ...l, phone: null, linkedAt: null });
    this.items.set(userId, { ...this.row(userId), phone, linkedAt: at, code: null, codeExpiresAt: null });
  }
  async unlink(userId: string) { this.items.delete(userId); }
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
    invites: new InMemoryInvitesRepository(),
    passwordResets: new InMemoryPasswordResetsRepository(),
    chat: new InMemoryChatMessagesRepository(),
    plans: new InMemoryFinancialPlansRepository(),
    whatsapp: new InMemoryWhatsappLinksRepository(),
  } satisfies Repositories;
}
