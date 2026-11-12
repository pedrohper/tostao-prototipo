// Repositórios de verdade, no Postgres via Prisma.
// Repare que a assinatura é a mesma dos em memória: o use case nem percebe a troca.
import type { PrismaClient } from '@prisma/client';
import type { Account, BankConnection, Category, CategoryRule, Transaction } from '../../domain/entities.js';
import type {
  AccountsRepository, BankConnectionsRepository, CategoriesRepository, CategoryRulesRepository,
  NewTransaction, NewUser, Repositories, TransactionsRepository, UsersRepository,
} from '../types.js';

class PrismaUsersRepository implements UsersRepository {
  constructor(private db: PrismaClient) {}
  findByEmail(email: string) { return this.db.user.findUnique({ where: { email } }); }
  findById(id: string) { return this.db.user.findUnique({ where: { id } }); }
  create(data: NewUser) { return this.db.user.create({ data }); }
}

class PrismaBankConnectionsRepository implements BankConnectionsRepository {
  constructor(private db: PrismaClient) {}
  async findById(id: string) { return (await this.db.bankConnection.findUnique({ where: { id } })) as BankConnection | null; }
  async findByUserAndItem(userId: string, itemId: string) {
    return (await this.db.bankConnection.findUnique({ where: { userId_itemId: { userId, itemId } } })) as BankConnection | null;
  }
  async listByUser(userId: string) { return (await this.db.bankConnection.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })) as BankConnection[]; }
  async listActive() { return (await this.db.bankConnection.findMany({ where: { status: 'ACTIVE' } })) as BankConnection[]; }
  async create(data: Pick<BankConnection, 'userId' | 'itemId' | 'institution'>) { return (await this.db.bankConnection.create({ data })) as BankConnection; }
  async save({ id, status, lastSyncedAt, institution }: BankConnection) {
    await this.db.bankConnection.update({ where: { id }, data: { status, lastSyncedAt, institution } });
  }
  // onDelete: Cascade no schema leva junto contas e transações dessa conexão
  async delete(id: string) { await this.db.bankConnection.delete({ where: { id } }); }
}

class PrismaAccountsRepository implements AccountsRepository {
  constructor(private db: PrismaClient) {}
  async upsertByExternalId(data: Omit<Account, 'id'>) {
    return (await this.db.account.upsert({
      where: { userId_externalId: { userId: data.userId, externalId: data.externalId } },
      create: data,
      update: { name: data.name, balanceInCents: data.balanceInCents, type: data.type, fingerprint: data.fingerprint },
    })) as Account;
  }
  async listByUser(userId: string) { return (await this.db.account.findMany({ where: { userId }, orderBy: { name: 'asc' } })) as Account[]; }
  async findByFingerprint(userId: string, fingerprint: string) { return (await this.db.account.findMany({ where: { userId, fingerprint } })) as Account[]; }
  async delete(id: string) { await this.db.account.delete({ where: { id } }); }
}

class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private db: PrismaClient) {}
  async list() { return (await this.db.category.findMany({ orderBy: { name: 'asc' } })) as Category[]; }
  async findById(id: string) { return (await this.db.category.findUnique({ where: { id } })) as Category | null; }
}

class PrismaCategoryRulesRepository implements CategoryRulesRepository {
  constructor(private db: PrismaClient) {}
  listForUser(userId: string): Promise<CategoryRule[]> {
    return this.db.categoryRule.findMany({ where: { OR: [{ userId: null }, { userId }] } });
  }
  async upsert(data: Omit<CategoryRule, 'id'>) {
    // Atalho: o unique (userId, pattern) do Postgres não trata null como igual,
    // então buscamos antes. Só regras de usuário passam por aqui.
    const found = await this.db.categoryRule.findFirst({ where: { userId: data.userId, pattern: data.pattern } });
    if (found) return this.db.categoryRule.update({ where: { id: found.id }, data: { categoryId: data.categoryId } });
    return this.db.categoryRule.create({ data });
  }
}

class PrismaTransactionsRepository implements TransactionsRepository {
  constructor(private db: PrismaClient) {}
  findById(id: string): Promise<Transaction | null> { return this.db.transaction.findUnique({ where: { id } }); }
  findByExternalId(userId: string, externalId: string): Promise<Transaction | null> {
    return this.db.transaction.findUnique({ where: { userId_externalId: { userId, externalId } } });
  }
  findManyInRange(userId: string, from: Date, to: Date): Promise<Transaction[]> {
    return this.db.transaction.findMany({ where: { userId, occurredAt: { gte: from, lt: to } }, orderBy: { occurredAt: 'desc' } });
  }
  findUncategorized(userId: string): Promise<Transaction[]> {
    return this.db.transaction.findMany({ where: { userId, categoryId: null, isInternalTransfer: false } });
  }
  create(data: NewTransaction): Promise<Transaction> { return this.db.transaction.create({ data }); }
  async save({ id, categoryId, isInternalTransfer, description }: Transaction) {
    await this.db.transaction.update({ where: { id }, data: { categoryId, isInternalTransfer, description } });
  }
}

export function makePrismaRepositories(db: PrismaClient): Repositories {
  return {
    users: new PrismaUsersRepository(db),
    connections: new PrismaBankConnectionsRepository(db),
    accounts: new PrismaAccountsRepository(db),
    categories: new PrismaCategoriesRepository(db),
    rules: new PrismaCategoryRulesRepository(db),
    transactions: new PrismaTransactionsRepository(db),
  };
}
