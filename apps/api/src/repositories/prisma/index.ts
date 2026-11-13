// Repositórios de verdade, no Postgres via Prisma.
// Repare que a assinatura é a mesma dos em memória: o use case nem percebe a troca.
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Account, BankConnection, Category, CategoryBudget, CategoryRule, Transaction, Invite, PasswordReset, ChatMessage, Battle, BattleKind } from '../../domain/entities.js';
import type { FinancialPlan } from '@tostao/contracts';
import type {
  AccountData, AccountsRepository, FinancialPlansRepository, BankConnectionsRepository, BudgetsRepository, CategoriesRepository, CategoryRulesRepository, ChatMessagesRepository, IgnoredSubscriptionsRepository, InvitesRepository, GamesRepository, EngagementRepository, PushSub, LessonProgressRepository, PasswordResetsRepository,
  NewTransaction, NewUser, Repositories, TransactionsRepository, UsersRepository, WhatsappLinksRepository,
} from '../types.js';

class PrismaUsersRepository implements UsersRepository {
  constructor(private db: PrismaClient) {}
  findByEmail(email: string) { return this.db.user.findUnique({ where: { email } }); }
  findById(id: string) { return this.db.user.findUnique({ where: { id } }); }
  create(data: NewUser) { return this.db.user.create({ data }); }
  count() { return this.db.user.count(); }
  async updatePassword(id: string, passwordHash: string) { await this.db.user.update({ where: { id }, data: { passwordHash } }); }
  async delete(id: string) { await this.db.user.delete({ where: { id } }); } // o resto vai junto (onDelete: Cascade)
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
  async upsertByExternalId(data: AccountData) {
    return (await this.db.account.upsert({
      where: { userId_externalId: { userId: data.userId, externalId: data.externalId } },
      create: data,
      update: {
        name: data.name, balanceInCents: data.balanceInCents, type: data.type, fingerprint: data.fingerprint,
        // Import de extrato não manda limite/vencimento: aí não mexe no que já tem.
        ...(data.creditLimitInCents !== undefined && { creditLimitInCents: data.creditLimitInCents }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      },
    })) as Account;
  }
  async listByUser(userId: string) { return (await this.db.account.findMany({ where: { userId }, orderBy: { name: 'asc' } })) as Account[]; }
  async findByFingerprint(userId: string, fingerprint: string) { return (await this.db.account.findMany({ where: { userId, fingerprint } })) as Account[]; }
  async delete(id: string) { await this.db.account.delete({ where: { id } }); }
  async setHidden(id: string, hidden: boolean) { await this.db.account.update({ where: { id }, data: { hidden } }); }
}

class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private db: PrismaClient) {}
  async list(userId?: string) {
    return (await this.db.category.findMany({ where: { OR: [{ userId: null }, ...(userId ? [{ userId }] : [])] }, orderBy: { name: 'asc' } })) as Category[];
  }
  async findById(id: string) { return (await this.db.category.findUnique({ where: { id } })) as Category | null; }
  async create(data: Omit<Category, 'id'> & { userId: string }) {
    return (await this.db.category.create({ data: { ...data, id: `u-${crypto.randomUUID()}` } })) as Category;
  }
  async delete(id: string) { await this.db.category.delete({ where: { id } }); }
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
  async deleteByCategory(categoryId: string) { await this.db.categoryRule.deleteMany({ where: { categoryId } }); }
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
  async save({ id, categoryId, isInternalTransfer, description, amountInCents }: Transaction) {
    await this.db.transaction.update({ where: { id }, data: { categoryId, isInternalTransfer, description, amountInCents } });
  }
  async clearCategory(categoryId: string) { await this.db.transaction.updateMany({ where: { categoryId }, data: { categoryId: null } }); }
}

class PrismaBudgetsRepository implements BudgetsRepository {
  constructor(private db: PrismaClient) {}
  listByUser(userId: string): Promise<CategoryBudget[]> { return this.db.categoryBudget.findMany({ where: { userId } }); }
  upsert({ userId, categoryId, limitInCents }: Omit<CategoryBudget, 'id'>) {
    return this.db.categoryBudget.upsert({ where: { userId_categoryId: { userId, categoryId } }, create: { userId, categoryId, limitInCents }, update: { limitInCents } });
  }
  async delete(userId: string, categoryId: string) { await this.db.categoryBudget.deleteMany({ where: { userId, categoryId } }); }
  async deleteByCategory(categoryId: string) { await this.db.categoryBudget.deleteMany({ where: { categoryId } }); }
}

class PrismaLessonProgressRepository implements LessonProgressRepository {
  constructor(private db: PrismaClient) {}
  listByUser(userId: string) { return this.db.lessonProgress.findMany({ where: { userId }, orderBy: { completedAt: 'asc' } }); }
  async markDone(userId: string, lessonId: string) {
    await this.db.lessonProgress.upsert({ where: { userId_lessonId: { userId, lessonId } }, create: { userId, lessonId }, update: {} });
  }
}

class PrismaGamesRepository implements GamesRepository {
  constructor(private db: PrismaClient) {}
  async vote(userId: string, caseId: string, choice: number) {
    await this.db.tribunalVote.upsert({ where: { userId_caseId: { userId, caseId } }, create: { userId, caseId, choice }, update: { choice, votedAt: new Date() } });
  }
  findVote(userId: string, caseId: string) { return this.db.tribunalVote.findUnique({ where: { userId_caseId: { userId, caseId } } }); }
  async countVotes(caseId: string) {
    const rows = await this.db.tribunalVote.groupBy({ by: ['choice'], where: { caseId }, _count: { _all: true } });
    const counts: number[] = [];
    for (const r of rows) counts[r.choice] = r._count._all;
    return Array.from(counts, (c) => c ?? 0);
  }
  countUserVotes(userId: string) { return this.db.tribunalVote.count({ where: { userId } }); }
  async listBattles(userId: string) { return (await this.db.battle.findMany({ where: { userId } })) as Battle[]; }
  async saveBattle(b: Battle) {
    const data = { status: b.status, startedAt: b.startedAt, endedAt: b.endedAt, steps: b.steps };
    await this.db.battle.upsert({ where: { userId_kind: { userId: b.userId, kind: b.kind } }, create: { userId: b.userId, kind: b.kind, ...data }, update: data });
  }
  async findBattle(userId: string, kind: BattleKind) { return (await this.db.battle.findUnique({ where: { userId_kind: { userId, kind } } })) as Battle | null; }
}

class PrismaIgnoredSubscriptionsRepository implements IgnoredSubscriptionsRepository {
  constructor(private db: PrismaClient) {}
  async listKeys(userId: string) { return (await this.db.ignoredSubscription.findMany({ where: { userId } })).map((r) => r.key); }
  async set(userId: string, key: string, ignored: boolean) {
    if (ignored) await this.db.ignoredSubscription.upsert({ where: { userId_key: { userId, key } }, create: { userId, key }, update: {} });
    else await this.db.ignoredSubscription.deleteMany({ where: { userId, key } });
  }
}

class PrismaInvitesRepository implements InvitesRepository {
  constructor(private db: PrismaClient) {}
  create(data: { code: string; createdById: string }) { return this.db.invite.create({ data }); }
  findByCode(code: string) { return this.db.invite.findUnique({ where: { code } }); }
  async markUsed(code: string, userId: string) { await this.db.invite.update({ where: { code }, data: { usedById: userId, usedAt: new Date() } }); }
  listByCreator(userId: string) { return this.db.invite.findMany({ where: { createdById: userId }, orderBy: { createdAt: 'desc' } }); }
}

class PrismaPasswordResetsRepository implements PasswordResetsRepository {
  constructor(private db: PrismaClient) {}
  create(data: { userId: string; tokenHash: string; expiresAt: Date }) { return this.db.passwordReset.create({ data }); }
  findByTokenHash(tokenHash: string) { return this.db.passwordReset.findUnique({ where: { tokenHash } }); }
  async markUsed(id: string) { await this.db.passwordReset.update({ where: { id }, data: { usedAt: new Date() } }); }
}

class PrismaChatMessagesRepository implements ChatMessagesRepository {
  constructor(private db: PrismaClient) {}
  async listRecent(userId: string, limit: number) {
    const rows = await this.db.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
    return rows.reverse() as ChatMessage[];
  }
  async create(data: Omit<ChatMessage, 'id' | 'createdAt'>) { return (await this.db.chatMessage.create({ data })) as ChatMessage; }
  countUserSince(userId: string, since: Date) { return this.db.chatMessage.count({ where: { userId, role: 'user', createdAt: { gte: since } } }); }
}

class PrismaFinancialPlansRepository implements FinancialPlansRepository {
  constructor(private readonly db: PrismaClient) {}
  async get(userId: string) {
    const row = await this.db.financialPlan.findUnique({ where: { userId } });
    return row ? (row.data as unknown as FinancialPlan) : null;
  }
  async save(userId: string, plan: FinancialPlan) {
    const data = plan as unknown as Prisma.InputJsonObject;
    await this.db.financialPlan.upsert({ where: { userId }, create: { userId, data }, update: { data } });
  }
}

class PrismaWhatsappLinksRepository implements WhatsappLinksRepository {
  constructor(private readonly db: PrismaClient) {}
  get(userId: string) { return this.db.whatsappLink.findUnique({ where: { userId } }); }
  findByPhone(phone: string) { return this.db.whatsappLink.findUnique({ where: { phone } }); }
  findByCode(code: string) { return this.db.whatsappLink.findUnique({ where: { code } }); }
  async setCode(userId: string, code: string, expiresAt: Date) {
    await this.db.whatsappLink.upsert({ where: { userId }, create: { userId, code, codeExpiresAt: expiresAt }, update: { code, codeExpiresAt: expiresAt } });
  }
  async link(userId: string, phone: string, at: Date) {
    await this.db.$transaction([
      this.db.whatsappLink.updateMany({ where: { phone, NOT: { userId } }, data: { phone: null, linkedAt: null } }),
      this.db.whatsappLink.upsert({ where: { userId }, create: { userId, phone, linkedAt: at }, update: { phone, linkedAt: at, code: null, codeExpiresAt: null } }),
    ]);
  }
  async unlink(userId: string) { await this.db.whatsappLink.deleteMany({ where: { userId } }); }
}

class PrismaEngagementRepository implements EngagementRepository {
  constructor(private db: PrismaClient) {}
  async markActivity(userId: string, day: string, kind: string) {
    await this.db.userActivity.upsert({ where: { userId_day_kind: { userId, day, kind } }, create: { userId, day, kind }, update: {} });
  }
  listActivity(userId: string, sinceDay: string) {
    return this.db.userActivity.findMany({ where: { userId, day: { gte: sinceDay } }, select: { day: true, kind: true } });
  }
  countActivity(userId: string) { return this.db.userActivity.count({ where: { userId } }); }
  async getFriendCode(userId: string) { return (await this.db.friendCode.findUnique({ where: { userId } }))?.code ?? null; }
  async setFriendCode(userId: string, code: string) { await this.db.friendCode.upsert({ where: { userId }, create: { userId, code }, update: { code } }); }
  async findUserByFriendCode(code: string) { return (await this.db.friendCode.findUnique({ where: { code } }))?.userId ?? null; }
  async addFriend(a: string, b: string) {
    await this.db.friendship.createMany({ data: [{ userId: a, friendId: b }, { userId: b, friendId: a }], skipDuplicates: true });
  }
  async removeFriend(a: string, b: string) {
    await this.db.friendship.deleteMany({ where: { OR: [{ userId: a, friendId: b }, { userId: b, friendId: a }] } });
  }
  async listFriendIds(userId: string) { return (await this.db.friendship.findMany({ where: { userId }, select: { friendId: true } })).map((f) => f.friendId); }
  async savePush(sub: PushSub) {
    await this.db.pushSubscription.upsert({ where: { endpoint: sub.endpoint }, create: sub, update: { userId: sub.userId, p256dh: sub.p256dh, auth: sub.auth } });
  }
  async deletePush(endpoint: string) { await this.db.pushSubscription.deleteMany({ where: { endpoint } }); }
  listPush(userId: string) { return this.db.pushSubscription.findMany({ where: { userId }, select: { endpoint: true, userId: true, p256dh: true, auth: true } }); }
  async listPushUserIds() { return (await this.db.pushSubscription.findMany({ distinct: ['userId'], select: { userId: true } })).map((p) => p.userId); }
  async claimNotification(userId: string, key: string) {
    const r = await this.db.sentNotification.createMany({ data: [{ userId, key }], skipDuplicates: true });
    return r.count === 1;
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
    budgets: new PrismaBudgetsRepository(db),
    lessons: new PrismaLessonProgressRepository(db),
    ignoredSubscriptions: new PrismaIgnoredSubscriptionsRepository(db),
    invites: new PrismaInvitesRepository(db),
    passwordResets: new PrismaPasswordResetsRepository(db),
    chat: new PrismaChatMessagesRepository(db),
    plans: new PrismaFinancialPlansRepository(db),
    whatsapp: new PrismaWhatsappLinksRepository(db),
    games: new PrismaGamesRepository(db),
    engagement: new PrismaEngagementRepository(db),
  };
}
