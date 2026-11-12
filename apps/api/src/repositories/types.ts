// Contratos dos repositórios. O use case pede "alguém que saiba salvar usuário",
// sem saber se é Postgres ou um array na memória (nos testes).
import type { Account, BankConnection, Category, CategoryRule, Transaction, User, CategoryBudget, LessonProgress, Invite, PasswordReset } from '../domain/entities.js';

export type NewUser = Pick<User, 'name' | 'email' | 'passwordHash'>;
export interface UsersRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: NewUser): Promise<User>;
  count(): Promise<number>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

export interface BankConnectionsRepository {
  findById(id: string): Promise<BankConnection | null>;
  findByUserAndItem(userId: string, itemId: string): Promise<BankConnection | null>;
  listByUser(userId: string): Promise<BankConnection[]>;
  listActive(): Promise<BankConnection[]>;
  create(data: Pick<BankConnection, 'userId' | 'itemId' | 'institution'>): Promise<BankConnection>;
  save(connection: BankConnection): Promise<void>;
  /** Apaga a conexão e, em cascata, as contas e transações importadas dela. */
  delete(id: string): Promise<void>;
}

export type AccountData = Pick<Account, 'userId' | 'connectionId' | 'externalId' | 'name' | 'type' | 'balanceInCents' | 'fingerprint'>;
export interface AccountsRepository {
  upsertByExternalId(data: AccountData): Promise<Account>;
  listByUser(userId: string): Promise<Account[]>;
  findByFingerprint(userId: string, fingerprint: string): Promise<Account[]>;
  /** Apaga a conta e, em cascata, as transações dela. */
  delete(id: string): Promise<void>;
  setHidden(id: string, hidden: boolean): Promise<void>;
}

export interface CategoriesRepository {
  /** Do sistema + as criadas por essa pessoa (sem userId: só as do sistema). */
  list(userId?: string): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  create(data: Omit<Category, 'id'> & { userId: string }): Promise<Category>;
  delete(id: string): Promise<void>;
}

export interface CategoryRulesRepository {
  /** Regras do sistema + regras desse usuário */
  listForUser(userId: string): Promise<CategoryRule[]>;
  upsert(data: Omit<CategoryRule, 'id'>): Promise<CategoryRule>;
  deleteByCategory(categoryId: string): Promise<void>;
}

export interface BudgetsRepository {
  listByUser(userId: string): Promise<CategoryBudget[]>;
  upsert(data: Omit<CategoryBudget, 'id'>): Promise<CategoryBudget>;
  delete(userId: string, categoryId: string): Promise<void>;
  deleteByCategory(categoryId: string): Promise<void>;
}

export interface LessonProgressRepository {
  listByUser(userId: string): Promise<LessonProgress[]>;
  /** Idempotente: marcar de novo não duplica. */
  markDone(userId: string, lessonId: string): Promise<void>;
}

export interface IgnoredSubscriptionsRepository {
  listKeys(userId: string): Promise<string[]>;
  set(userId: string, key: string, ignored: boolean): Promise<void>;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;
export interface TransactionsRepository {
  findById(id: string): Promise<Transaction | null>;
  findByExternalId(userId: string, externalId: string): Promise<Transaction | null>;
  /** Intervalo [from, to) */
  findManyInRange(userId: string, from: Date, to: Date): Promise<Transaction[]>;
  findUncategorized(userId: string): Promise<Transaction[]>;
  create(data: NewTransaction): Promise<Transaction>;
  save(transaction: Transaction): Promise<void>;
  /** Tira a categoria (volta pra pendente) de todas as transações dela. */
  clearCategory(categoryId: string): Promise<void>;
}

export interface InvitesRepository {
  create(data: { code: string; createdById: string }): Promise<Invite>;
  findByCode(code: string): Promise<Invite | null>;
  markUsed(code: string, userId: string): Promise<void>;
  listByCreator(userId: string): Promise<Invite[]>;
}

export interface PasswordResetsRepository {
  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordReset>;
  findByTokenHash(tokenHash: string): Promise<PasswordReset | null>;
  markUsed(id: string): Promise<void>;
}

export type Repositories = {
  users: UsersRepository;
  connections: BankConnectionsRepository;
  accounts: AccountsRepository;
  categories: CategoriesRepository;
  rules: CategoryRulesRepository;
  transactions: TransactionsRepository;
  budgets: BudgetsRepository;
  lessons: LessonProgressRepository;
  ignoredSubscriptions: IgnoredSubscriptionsRepository;
  invites: InvitesRepository;
  passwordResets: PasswordResetsRepository;
};
