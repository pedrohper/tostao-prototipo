// Repositórios de verdade, no Postgres via Prisma.
// Repare que a assinatura é a mesma dos em memória: o use case nem percebe a troca.
import type { Prisma, PrismaClient } from '@prisma/client';
import { toBigCents, toCents, toCentsOrNull } from '../../lib/money.js';
import { shouldReopenInsight } from '../../services/insight-reopen.js';
import { ConflictError, ForbiddenError } from '../../domain/errors.js';
import type {
  Account,
  BankConnection,
  Category,
  CategoryBudget,
  CategoryRule,
  Transaction,
  ChatMessage,
  Battle,
  BattleKind,
  Person,
  TostaoInsight,
  TostaoAutoConfig,
  TostaoInsightStatus,
  ReconciledNote,
  OAuthAccount,
  OAuthProvider,
  OutboxJob,
  UserConsent,
  FriendRequest,
} from '../../domain/entities.js';
import type { FinancialPlan, UpdateTostaoAutoConfigBody } from '@tostao/contracts';
import type {
  AccountData,
  AccountsRepository,
  PersonBalance,
  TransactionSearchFilter,
  TransactionSearchResult,
  FinancialPlansRepository,
  BankConnectionsRepository,
  BudgetsRepository,
  CategoriesRepository,
  CategoryRulesRepository,
  ChatMessagesRepository,
  IgnoredSubscriptionsRepository,
  InvitesRepository,
  GamesRepository,
  EngagementRepository,
  PushSub,
  LessonProgressRepository,
  PasswordResetsRepository,
  RefreshTokensRepository,
  EmailVerificationTokensRepository,
  NewRefreshToken,
  RotateRefreshResult,
  NewTransaction,
  NewUser,
  NewOAuthAccount,
  OAuthAccountsRepository,
  PeopleRepository,
  Repositories,
  TransactionsRepository,
  UsersRepository,
  WhatsappLinksRepository,
  TostaoAutoRepository,
  UpsertTostaoInsight,
  ReconciledNotesRepository,
  NewReconciledNote,
  OutboxRepository,
  AuditLogRepository,
  UserConsentsRepository,
  NewOutboxJob,
  NewAuditLog,
} from '../types.js';

/** O cliente normal ou o de dentro de uma $transaction: os repositórios funcionam igual nos dois. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Abre uma transação, ou reaproveita a que já está aberta (Prisma não aninha). */
function inTx<T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return '$transaction' in db ? db.$transaction((tx) => fn(tx)) : fn(db);
}

const mapAccount = (r: Prisma.AccountGetPayload<object>): Account => ({
  ...r,
  balanceInCents: toCents(r.balanceInCents),
  creditLimitInCents: toCentsOrNull(r.creditLimitInCents),
});
const mapTransaction = (r: Prisma.TransactionGetPayload<object>): Transaction => ({
  ...r,
  amountInCents: toCents(r.amountInCents),
});
const mapBudget = (r: Prisma.CategoryBudgetGetPayload<object>): CategoryBudget => ({
  ...r,
  limitInCents: toCents(r.limitInCents),
});
const mapNote = (r: Prisma.ReconciledNoteGetPayload<object>): ReconciledNote => ({
  ...r,
  amountInCents: toCents(r.amountInCents),
});
const accountWrite = (a: AccountData) => ({
  ...a,
  balanceInCents: toBigCents(a.balanceInCents),
  ...(a.creditLimitInCents !== undefined && {
    creditLimitInCents: a.creditLimitInCents === null ? null : toBigCents(a.creditLimitInCents),
  }),
});
const transactionWrite = (t: NewTransaction) => ({ ...t, amountInCents: toBigCents(t.amountInCents) });

/** A coluna é `date`: o resto do app continua falando 'AAAA-MM-DD'. */
const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dateToDay = (d: Date) => d.toISOString().slice(0, 10);

class PrismaUsersRepository implements UsersRepository {
  constructor(private db: Db) {}
  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }
  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }
  async listAllIds() {
    return (await this.db.user.findMany({ select: { id: true } })).map((u) => u.id);
  }
  findManyByIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.user.findMany({ where: { id: { in: ids } } });
  }
  create(data: NewUser) {
    return this.db.user.create({ data });
  }
  count() {
    return this.db.user.count();
  }
  async updatePassword(id: string, passwordHash: string) {
    await this.db.user.update({ where: { id }, data: { passwordHash } });
  }
  async markEmailVerified(id: string, at: Date) {
    await this.db.user.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: at } });
  }
  async setAiConsent(id: string, at: Date | null) {
    await this.db.user.update({ where: { id }, data: { aiConsentAt: at } });
  }
  async delete(id: string) {
    await this.db.user.delete({ where: { id } });
  } // o resto vai junto (onDelete: Cascade)
}

class PrismaOAuthAccountsRepository implements OAuthAccountsRepository {
  constructor(private db: Db) {}
  async findByProviderAccount(provider: OAuthProvider, providerAccountId: string) {
    return (await this.db.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    })) as OAuthAccount | null;
  }
  async listByUser(userId: string) {
    return (await this.db.oAuthAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })) as OAuthAccount[];
  }
  async create(data: NewOAuthAccount) {
    return (await this.db.oAuthAccount.create({ data })) as OAuthAccount;
  }
}

class PrismaBankConnectionsRepository implements BankConnectionsRepository {
  constructor(private db: Db) {}
  async findById(id: string) {
    return (await this.db.bankConnection.findUnique({ where: { id } })) as BankConnection | null;
  }
  async findByUserAndItem(userId: string, itemId: string) {
    return (await this.db.bankConnection.findUnique({
      where: { userId_itemId: { userId, itemId } },
    })) as BankConnection | null;
  }
  async findByItemId(itemId: string) {
    return (await this.db.bankConnection.findFirst({ where: { itemId } })) as BankConnection | null;
  }
  async listByUser(userId: string) {
    return (await this.db.bankConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })) as BankConnection[];
  }
  async listActive() {
    return (await this.db.bankConnection.findMany({ where: { status: 'ACTIVE' } })) as BankConnection[];
  }
  async listRetryable(before: Date) {
    return (await this.db.bankConnection.findMany({
      where: { status: 'ERROR', OR: [{ lastErrorAt: null }, { lastErrorAt: { lte: before } }] },
    })) as BankConnection[];
  }
  async create(data: Pick<BankConnection, 'userId' | 'itemId' | 'institution'>) {
    try {
      return (await this.db.bankConnection.create({ data })) as BankConnection;
    } catch (err) {
      // Índice único parcial bank_connections_pluggy_item_id_key: duas pessoas tentando o mesmo Item ao mesmo tempo.
      if ((err as { code?: string }).code === 'P2002') throw new ConflictError('Essa conexão não está disponível.');
      throw err;
    }
  }
  async save({ id, status, lastSyncedAt, institution, errorCount, lastErrorAt }: BankConnection) {
    await this.db.bankConnection.update({
      where: { id },
      data: { status, lastSyncedAt, institution, errorCount, lastErrorAt },
    });
  }
  // onDelete: Cascade no schema leva junto contas e transações dessa conexão
  async delete(id: string) {
    await this.db.bankConnection.delete({ where: { id } });
  }
}

class PrismaAccountsRepository implements AccountsRepository {
  constructor(private db: Db) {}
  async upsertByExternalId(data: AccountData) {
    const write = accountWrite(data);
    return mapAccount(
      await this.db.account.upsert({
        where: { userId_externalId: { userId: data.userId, externalId: data.externalId } },
        create: write,
        update: {
          name: data.name,
          balanceInCents: write.balanceInCents,
          type: data.type,
          fingerprint: data.fingerprint,
          // Import de extrato não manda limite/vencimento: aí não mexe no que já tem.
          ...(write.creditLimitInCents !== undefined && { creditLimitInCents: write.creditLimitInCents }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        },
      }),
    );
  }
  async listByUser(userId: string) {
    return (await this.db.account.findMany({ where: { userId }, orderBy: { name: 'asc' } })).map(mapAccount);
  }
  async findByFingerprint(userId: string, fingerprint: string) {
    return (await this.db.account.findMany({ where: { userId, fingerprint } })).map(mapAccount);
  }
  async delete(id: string) {
    await this.db.account.delete({ where: { id } });
  }
  async setHidden(id: string, hidden: boolean) {
    await this.db.account.update({ where: { id }, data: { hidden } });
  }
  async adjustBalance(id: string, deltaInCents: number) {
    // increment: o Postgres faz balance = balance + delta numa instrução só (sem ler e regravar).
    await this.db.account.update({ where: { id }, data: { balanceInCents: { increment: toBigCents(deltaInCents) } } });
  }
}

class PrismaCategoriesRepository implements CategoriesRepository {
  constructor(private db: Db) {}
  async list(userId?: string) {
    return (await this.db.category.findMany({
      where: { OR: [{ userId: null }, ...(userId ? [{ userId }] : [])] },
      orderBy: { name: 'asc' },
    })) as Category[];
  }
  async findById(id: string) {
    return (await this.db.category.findUnique({ where: { id } })) as Category | null;
  }
  async create(data: Omit<Category, 'id'> & { userId: string }) {
    return (await this.db.category.create({ data: { ...data, id: `u-${crypto.randomUUID()}` } })) as Category;
  }
  async delete(id: string) {
    await this.db.category.delete({ where: { id } });
  }
}

class PrismaCategoryRulesRepository implements CategoryRulesRepository {
  constructor(private db: Db) {}
  listForUser(userId: string): Promise<CategoryRule[]> {
    return this.db.categoryRule.findMany({ where: { OR: [{ userId: null }, { userId }] } });
  }
  async upsert(data: Omit<CategoryRule, 'id'>) {
    // Regra de usuário: upsert atômico (INSERT ... ON CONFLICT no unique userId+pattern), sem "buscar e depois criar".
    if (data.userId) {
      return this.db.categoryRule.upsert({
        where: { userId_pattern: { userId: data.userId, pattern: data.pattern } },
        create: data,
        update: { categoryId: data.categoryId },
      });
    }
    // Regra do sistema (user_id NULL): o índice category_rules_user_pattern_nn_key (NULLS NOT DISTINCT) barra duplicata.
    return inTx(this.db, async (tx) => {
      const found = await tx.categoryRule.findFirst({ where: { userId: null, pattern: data.pattern } });
      if (found) return tx.categoryRule.update({ where: { id: found.id }, data: { categoryId: data.categoryId } });
      return tx.categoryRule.create({ data });
    });
  }
  async deleteByCategory(userId: string, categoryId: string) {
    await this.db.categoryRule.deleteMany({ where: { userId, categoryId } });
  }
}

/** Depois do cursor, na ordem (occurredAt desc, id desc): mais antigo, ou na mesma data com id menor. */
const cursorWhere = (c: { occurredAt: Date; id: string }): Prisma.TransactionWhereInput => ({
  OR: [{ occurredAt: { lt: c.occurredAt } }, { occurredAt: c.occurredAt, id: { lt: c.id } }],
});

const ILIKE = (value: string) => ({ contains: value, mode: 'insensitive' as const });

/**
 * Rendimento automático de conta/CDB/dividendo (entrada). É o `isYieldTransaction` do contrato em SQL: as mesmas
 * palavras por ILIKE, e "Banco Rendimento" (o banco) nunca conta. Um teste contra o Postgres compara os dois.
 */
const yieldWhere: Prisma.TransactionWhereInput = {
  amountInCents: { gt: 0n },
  OR: [
    ILIKE('rendimento'),
    ILIKE('dividendo'),
    ILIKE('juros sobre capital'),
    ILIKE('jcp'),
    ILIKE('remuneracao'),
    ILIKE('remuneração'),
  ].map((description) => ({ description })),
  NOT: { description: ILIKE('banco rendimento') },
};

/** Todos os filtros da busca (menos a página) como um `where` do Prisma: quem filtra é o Postgres. */
function searchWhere(userId: string, f: TransactionSearchFilter): Prisma.TransactionWhereInput {
  const and: Prisma.TransactionWhereInput[] = [
    // Conta oculta some das telas, e o que passa nela também.
    { OR: [{ accountId: null }, { account: { hidden: false } }] },
  ];
  if (f.excludeTransfers) and.push({ isInternalTransfer: false });
  if (f.excludeYields) and.push({ NOT: yieldWhere });
  if (f.kind === 'saida') and.push({ amountInCents: { lt: 0n } });
  if (f.kind === 'entrada') and.push({ amountInCents: { gt: 0n } });
  if (f.categoryId === 'sem') and.push({ categoryId: null });
  else if (f.categoryId) and.push({ categoryId: f.categoryId });
  // Cada palavra em algum lugar: descrição (o GIN de trigrama acelera), nome da categoria ou nome da conta.
  for (const w of f.words)
    and.push({ OR: [{ description: ILIKE(w) }, { category: { name: ILIKE(w) } }, { account: { name: ILIKE(w) } }] });
  return { userId, occurredAt: { ...(f.from ? { gte: f.from } : {}), lt: f.to }, AND: and };
}

/** Tamanhos de lote: listas IN e INSERTs grandes passam do limite de parâmetros do Postgres (32.767). */
const IN_CHUNK = 1000;
const INSERT_CHUNK = 1000;

class PrismaTransactionsRepository implements TransactionsRepository {
  constructor(private db: Db) {}
  async findById(id: string): Promise<Transaction | null> {
    const row = await this.db.transaction.findUnique({ where: { id } });
    return row && mapTransaction(row);
  }
  async findByExternalId(userId: string, externalId: string): Promise<Transaction | null> {
    const row = await this.db.transaction.findUnique({ where: { userId_externalId: { userId, externalId } } });
    return row && mapTransaction(row);
  }
  async findByExternalIds(userId: string, externalIds: string[]): Promise<Transaction[]> {
    const out: Transaction[] = [];
    // Lotes: uma lista IN gigante estoura o limite de parâmetros do Postgres (arquivo com milhares de linhas).
    for (let i = 0; i < externalIds.length; i += IN_CHUNK) {
      const rows = await this.db.transaction.findMany({
        where: { userId, externalId: { in: externalIds.slice(i, i + IN_CHUNK) } },
      });
      out.push(...rows.map(mapTransaction));
    }
    return out;
  }
  async findManyInRange(userId: string, from: Date, to: Date): Promise<Transaction[]> {
    const rows = await this.db.transaction.findMany({
      where: { userId, occurredAt: { gte: from, lt: to } },
      orderBy: { occurredAt: 'desc' },
    });
    return rows.map(mapTransaction);
  }
  async findUncategorized(userId: string): Promise<Transaction[]> {
    const rows = await this.db.transaction.findMany({ where: { userId, categoryId: null, isInternalTransfer: false } });
    return rows.map(mapTransaction);
  }
  async create(data: NewTransaction): Promise<Transaction> {
    return mapTransaction(await this.db.transaction.create({ data: transactionWrite(data) }));
  }
  async createMany(data: (NewTransaction & { id?: string })[], opts?: { skipDuplicates?: boolean }): Promise<number> {
    if (data.length === 0) return 0;
    if (!opts?.skipDuplicates)
      return (await this.db.transaction.createMany({ data: data.map(transactionWrite) })).count;
    let created = 0;
    for (let i = 0; i < data.length; i += INSERT_CHUNK) {
      created += (
        await this.db.transaction.createMany({
          data: data.slice(i, i + INSERT_CHUNK).map(transactionWrite),
          skipDuplicates: true,
        })
      ).count;
    }
    return created;
  }
  async setInternalTransfer(userId: string, ids: string[], isInternalTransfer: boolean): Promise<number> {
    let changed = 0;
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
      changed += (
        await this.db.transaction.updateMany({
          where: { userId, id: { in: ids.slice(i, i + IN_CHUNK) } },
          data: { isInternalTransfer },
        })
      ).count;
    }
    return changed;
  }
  async categorizeUncategorized(userId: string, ids: string[], categoryId: string): Promise<number> {
    if (ids.length === 0) return 0;
    return (
      await this.db.transaction.updateMany({
        where: { userId, id: { in: ids }, categoryId: null },
        data: { categoryId },
      })
    ).count;
  }
  async search(userId: string, f: TransactionSearchFilter): Promise<TransactionSearchResult> {
    const where = searchWhere(userId, f);
    // Página: pede 1 a mais pra saber se tem próxima, sem um COUNT só pra isso.
    const [rows, count, out, inn] = await Promise.all([
      this.db.transaction.findMany({
        where: f.cursor ? { AND: [where, cursorWhere(f.cursor)] } : where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: f.limit + 1,
      }),
      this.db.transaction.count({ where }),
      // Transferência interna aparece na lista mas não entra na soma.
      this.db.transaction.aggregate({
        where: { AND: [where, { isInternalTransfer: false, amountInCents: { lt: 0n } }] },
        _sum: { amountInCents: true },
      }),
      this.db.transaction.aggregate({
        where: { AND: [where, { isInternalTransfer: false, amountInCents: { gt: 0n } }] },
        _sum: { amountInCents: true },
      }),
    ]);
    const page = rows.slice(0, f.limit).map(mapTransaction);
    const last = page.at(-1);
    return {
      transactions: page,
      nextCursor: rows.length > f.limit && last ? { occurredAt: last.occurredAt, id: last.id } : null,
      count,
      outInCents: 0 - toCents(out._sum.amountInCents ?? 0n), // `0 -` e não `-`: evita -0
      inInCents: toCents(inn._sum.amountInCents ?? 0n),
    };
  }
  async summarizeByPerson(userId: string): Promise<PersonBalance[]> {
    const rows = await this.db.transaction.groupBy({
      by: ['personId'],
      where: { userId, personId: { not: null } },
      _sum: { amountInCents: true },
      _count: true,
      _max: { occurredAt: true },
    });
    return rows.map((r) => ({
      personId: r.personId!,
      // O saldo é o que SAIU (negativo no extrato) menos o que entrou: o sinal inverso da soma.
      balanceInCents: 0 - toCents(r._sum.amountInCents ?? 0n), // `0 -` e não `-`: evita -0
      count: r._count,
      lastAt: r._max.occurredAt,
    }));
  }
  async save({
    id,
    categoryId,
    isInternalTransfer,
    internalTransferManual,
    description,
    amountInCents,
    occurredAt,
    personId,
    note,
  }: Transaction) {
    await this.db.transaction.update({
      where: { id },
      data: {
        categoryId,
        isInternalTransfer,
        ...(internalTransferManual !== undefined ? { internalTransferManual } : {}),
        description,
        amountInCents: toBigCents(amountInCents),
        occurredAt,
        ...(personId !== undefined ? { personId } : {}),
        ...(note !== undefined ? { note } : {}),
      },
    });
  }
  async findByPerson(userId: string, personId: string): Promise<Transaction[]> {
    const rows = await this.db.transaction.findMany({ where: { userId, personId }, orderBy: { occurredAt: 'desc' } });
    return rows.map(mapTransaction);
  }
  async findManualByUser(userId: string): Promise<Transaction[]> {
    const rows = await this.db.transaction.findMany({
      where: { userId, externalId: null },
      orderBy: { occurredAt: 'desc' },
    });
    return rows.map(mapTransaction);
  }
  async clearCategory(userId: string, categoryId: string) {
    await this.db.transaction.updateMany({ where: { userId, categoryId }, data: { categoryId: null } });
  }
  async deleteBankByConnection(userId: string, connectionId: string) {
    // Só o que veio do banco (external_id não nulo). As anotações manuais ligadas a essas contas ficam
    // (a FK transactions.account_id é ON DELETE SET NULL, então só perdem o vínculo com a conta).
    return (
      await this.db.transaction.deleteMany({
        where: { userId, externalId: { not: null }, account: { connectionId } },
      })
    ).count;
  }
  async deleteBankByAccount(userId: string, accountId: string) {
    return (await this.db.transaction.deleteMany({ where: { userId, accountId, externalId: { not: null } } })).count;
  }
  async delete(id: string) {
    await this.db.transaction.delete({ where: { id } });
  }
  async deleteSeriesFrom(userId: string, seriesId: string, from: Date) {
    return (await this.db.transaction.deleteMany({ where: { userId, seriesId, occurredAt: { gte: from } } })).count;
  }
}

class PrismaReconciledNotesRepository implements ReconciledNotesRepository {
  constructor(private db: Db) {}
  async create(data: NewReconciledNote, at?: Date): Promise<ReconciledNote> {
    return mapNote(
      await this.db.reconciledNote.create({
        data: { ...data, amountInCents: toBigCents(data.amountInCents), ...(at ? { reconciledAt: at } : {}) },
      }),
    );
  }
  async listByUser(userId: string, limit = 100): Promise<ReconciledNote[]> {
    const rows = await this.db.reconciledNote.findMany({
      where: { userId },
      orderBy: { reconciledAt: 'desc' },
      take: limit,
    });
    return rows.map(mapNote);
  }
}

class PrismaBudgetsRepository implements BudgetsRepository {
  constructor(private db: Db) {}
  async listByUser(userId: string): Promise<CategoryBudget[]> {
    return (await this.db.categoryBudget.findMany({ where: { userId } })).map(mapBudget);
  }
  async upsert({ userId, categoryId, limitInCents }: Omit<CategoryBudget, 'id'>) {
    const limit = toBigCents(limitInCents);
    return mapBudget(
      await this.db.categoryBudget.upsert({
        where: { userId_categoryId: { userId, categoryId } },
        create: { userId, categoryId, limitInCents: limit },
        update: { limitInCents: limit },
      }),
    );
  }
  async delete(userId: string, categoryId: string) {
    await this.db.categoryBudget.deleteMany({ where: { userId, categoryId } });
  }
  async deleteByCategory(userId: string, categoryId: string) {
    await this.db.categoryBudget.deleteMany({ where: { userId, categoryId } });
  }
}

class PrismaLessonProgressRepository implements LessonProgressRepository {
  constructor(private db: Db) {}
  listByUser(userId: string) {
    return this.db.lessonProgress.findMany({ where: { userId }, orderBy: { completedAt: 'asc' } });
  }
  listByUsers(userIds: string[]) {
    if (userIds.length === 0) return Promise.resolve([]);
    return this.db.lessonProgress.findMany({ where: { userId: { in: userIds } }, orderBy: { completedAt: 'asc' } });
  }
  async markDone(userId: string, lessonId: string) {
    await this.db.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId },
      update: {},
    });
  }
}

/** Tentativas do lock otimista (version) antes de devolver 409. */
const MAX_VERSION_RETRIES = 3;

class PrismaGamesRepository implements GamesRepository {
  constructor(private db: Db) {}
  async vote(userId: string, caseId: string, weekKey: string, choice: number) {
    // INSERT ... ON CONFLICT DO NOTHING na PK (user, caso, semana): voto já dado nunca é trocado, nem numa corrida.
    const r = await this.db.tribunalVote.createMany({
      data: [{ userId, caseId, weekKey, choice }],
      skipDuplicates: true,
    });
    return r.count === 1;
  }
  findVote(userId: string, caseId: string, weekKey: string) {
    return this.db.tribunalVote.findUnique({ where: { userId_caseId_weekKey: { userId, caseId, weekKey } } });
  }
  async countVotes(caseId: string, weekKey: string) {
    const rows = await this.db.tribunalVote.groupBy({
      by: ['choice'],
      where: { caseId, weekKey },
      _count: { _all: true },
    });
    const counts: number[] = [];
    for (const r of rows) counts[r.choice] = r._count._all;
    return Array.from(counts, (c) => c ?? 0);
  }
  countUserVotes(userId: string) {
    return this.db.tribunalVote.count({ where: { userId } });
  }
  async listBattles(userId: string) {
    return (await this.db.battle.findMany({ where: { userId } })) as Battle[];
  }
  async saveBattle(b: Battle) {
    const data = { status: b.status, startedAt: b.startedAt, endedAt: b.endedAt, steps: b.steps };
    await this.db.battle.upsert({
      where: { userId_kind: { userId: b.userId, kind: b.kind } },
      create: { userId: b.userId, kind: b.kind, ...data },
      update: data,
    });
  }
  async findBattle(userId: string, kind: BattleKind) {
    return (await this.db.battle.findUnique({ where: { userId_kind: { userId, kind } } })) as Battle | null;
  }
  async mutateBattle(userId: string, kind: BattleKind, fn: (current: Battle | null) => Battle): Promise<Battle> {
    // Lock otimista: só grava se a version ainda é a que lemos; senão alguém escreveu no meio e tentamos de novo.
    for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt++) {
      const row = await this.db.battle.findUnique({ where: { userId_kind: { userId, kind } } });
      const next = fn(row as Battle | null);
      const data = { status: next.status, startedAt: next.startedAt, endedAt: next.endedAt, steps: next.steps };
      if (!row) {
        try {
          await this.db.battle.create({ data: { userId, kind, ...data } });
          return next;
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002') continue; // outra requisição criou primeiro
          throw err;
        }
      }
      const won = await this.db.battle.updateMany({
        where: { userId, kind, version: row.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (won.count === 1) return next;
    }
    throw new ConflictError('Isso mudou enquanto você mexia. Tenta de novo.');
  }
}

class PrismaIgnoredSubscriptionsRepository implements IgnoredSubscriptionsRepository {
  constructor(private db: Db) {}
  async listKeys(userId: string) {
    return (await this.db.ignoredSubscription.findMany({ where: { userId } })).map((r) => r.key);
  }
  async set(userId: string, key: string, ignored: boolean) {
    if (ignored)
      await this.db.ignoredSubscription.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key },
        update: {},
      });
    else await this.db.ignoredSubscription.deleteMany({ where: { userId, key } });
  }
}

class PrismaInvitesRepository implements InvitesRepository {
  constructor(private db: Db) {}
  create(data: { code: string; createdById: string }) {
    return this.db.invite.create({ data });
  }
  findByCode(code: string) {
    return this.db.invite.findUnique({ where: { code } });
  }
  async markUsed(code: string, userId: string) {
    // UPDATE condicional: só o primeiro a chegar acha used_at nulo. Convite já usado (mesmo que o convidado tenha
    // apagado a conta e used_by_id virou NULL) nunca reabre, porque o que manda é used_at.
    const claimed = await this.db.invite.updateMany({
      where: { code, usedAt: null },
      data: { usedById: userId, usedAt: new Date() },
    });
    return claimed.count === 1;
  }
  listByCreator(userId: string) {
    return this.db.invite.findMany({ where: { createdById: userId }, orderBy: { createdAt: 'desc' } });
  }
}

class PrismaPasswordResetsRepository implements PasswordResetsRepository {
  constructor(private db: Db) {}
  findByTokenHash(tokenHash: string) {
    return this.db.passwordReset.findUnique({ where: { tokenHash } });
  }
  replacePending(data: { userId: string; tokenHash: string; expiresAt: Date }, now: Date) {
    return inTx(this.db, async (tx) => {
      await tx.passwordReset.updateMany({ where: { userId: data.userId, usedAt: null }, data: { usedAt: now } });
      return tx.passwordReset.create({ data });
    });
  }
  redeem({ tokenHash, passwordHash, now }: { tokenHash: string; passwordHash: string; now: Date }) {
    return inTx(this.db, async (tx) => {
      // O UPDATE condicional é o cadeado: o Postgres serializa os dois resgates na mesma linha e só um vê usedAt nulo.
      const claimed = await tx.passwordReset.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return null;
      const reset = await tx.passwordReset.findUniqueOrThrow({ where: { tokenHash } });
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.user.updateMany({ where: { id: reset.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
      await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } });
      await tx.refreshToken.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: now } });
      return { userId: reset.userId };
    });
  }
}

class PrismaRefreshTokensRepository implements RefreshTokensRepository {
  constructor(private db: Db) {}
  create(data: NewRefreshToken) {
    return this.db.refreshToken.create({ data });
  }
  rotate({
    tokenHash,
    now,
    next,
  }: {
    tokenHash: string;
    now: Date;
    next: Omit<NewRefreshToken, 'userId' | 'familyId'>;
  }): Promise<RotateRefreshResult> {
    return inTx(this.db, async (tx) => {
      const claimed = await tx.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      const current = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!current) return { status: 'invalid' } as const;
      if (claimed.count === 1) {
        const created = await tx.refreshToken.create({
          data: { ...next, userId: current.userId, familyId: current.familyId },
        });
        await tx.refreshToken.update({ where: { id: current.id }, data: { replacedById: created.id } });
        return { status: 'rotated', userId: current.userId, familyId: current.familyId } as const;
      }
      if (current.revokedAt) {
        // Token já usado/revogado reapresentado: alguém tem uma cópia. Derruba a família toda.
        await tx.refreshToken.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { status: 'reused', userId: current.userId, familyId: current.familyId } as const;
      }
      return { status: 'invalid' } as const; // vencido
    });
  }
  async revokeFamilyOf(tokenHash: string, now: Date) {
    const row = await this.db.refreshToken.findUnique({ where: { tokenHash }, select: { familyId: true } });
    if (!row) return;
    await this.db.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
  async revokeAllForUser(userId: string, now: Date) {
    await this.db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  }
}

class PrismaEmailVerificationTokensRepository implements EmailVerificationTokensRepository {
  constructor(private db: Db) {}
  replacePending(data: { userId: string; tokenHash: string; expiresAt: Date }, now: Date) {
    return inTx(this.db, async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: { userId: data.userId, usedAt: null },
        data: { usedAt: now },
      });
      return tx.emailVerificationToken.create({ data });
    });
  }
  consume({ tokenHash, now }: { tokenHash: string; now: Date }) {
    return inTx(this.db, async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return null;
      const token = await tx.emailVerificationToken.findUniqueOrThrow({ where: { tokenHash } });
      await tx.user.updateMany({ where: { id: token.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
      return { userId: token.userId };
    });
  }
}

class PrismaChatMessagesRepository implements ChatMessagesRepository {
  constructor(private db: Db) {}
  async listRecent(userId: string, limit: number) {
    const rows = await this.db.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
    return rows.reverse() as ChatMessage[];
  }
  async create(data: Omit<ChatMessage, 'id' | 'createdAt'>) {
    return (await this.db.chatMessage.create({ data })) as ChatMessage;
  }
  countUserSince(userId: string, since: Date) {
    return this.db.chatMessage.count({ where: { userId, role: 'user', createdAt: { gte: since } } });
  }
}

class PrismaFinancialPlansRepository implements FinancialPlansRepository {
  constructor(private readonly db: Db) {}
  async get(userId: string) {
    const row = await this.db.financialPlan.findUnique({ where: { userId } });
    return row ? (row.data as unknown as FinancialPlan) : null;
  }
  async save(userId: string, plan: FinancialPlan) {
    const data = plan as unknown as Prisma.InputJsonObject;
    await this.db.financialPlan.upsert({
      where: { userId },
      create: { userId, data },
      update: { data, version: { increment: 1 } },
    });
  }
  async mutate(userId: string, fn: (current: FinancialPlan | null) => FinancialPlan): Promise<FinancialPlan> {
    // Lock otimista: só grava se a version ainda é a que lemos; senão alguém escreveu no meio e tentamos de novo.
    for (let attempt = 0; attempt < MAX_VERSION_RETRIES; attempt++) {
      const row = await this.db.financialPlan.findUnique({ where: { userId } });
      const next = fn(row ? (row.data as unknown as FinancialPlan) : null);
      const data = next as unknown as Prisma.InputJsonObject;
      if (!row) {
        try {
          await this.db.financialPlan.create({ data: { userId, data } });
          return next;
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002') continue; // outra requisição criou primeiro
          throw err;
        }
      }
      const won = await this.db.financialPlan.updateMany({
        where: { userId, version: row.version },
        data: { data, version: { increment: 1 } },
      });
      if (won.count === 1) return next;
    }
    throw new ConflictError('Isso mudou enquanto você mexia. Tenta de novo.');
  }
}

class PrismaWhatsappLinksRepository implements WhatsappLinksRepository {
  constructor(private readonly db: Db) {}
  get(userId: string) {
    return this.db.whatsappLink.findUnique({ where: { userId } });
  }
  findByPhone(phone: string) {
    return this.db.whatsappLink.findUnique({ where: { phone } });
  }
  findByCodeHash(codeHash: string) {
    return this.db.whatsappLink.findUnique({ where: { codeHash } });
  }
  async setCode(userId: string, codeHash: string, expiresAt: Date) {
    await this.db.whatsappLink.upsert({
      where: { userId },
      create: { userId, codeHash, codeExpiresAt: expiresAt },
      update: { codeHash, codeExpiresAt: expiresAt },
    });
  }
  async link(userId: string, phone: string, at: Date) {
    // phone é @unique: se o número já é de outra conta, isso falha (P2002) em vez de roubar o vínculo.
    await this.db.whatsappLink.upsert({
      where: { userId },
      create: { userId, phone, linkedAt: at },
      update: { phone, linkedAt: at, codeHash: null, codeExpiresAt: null },
    });
  }
  async unlink(userId: string) {
    await this.db.whatsappLink.deleteMany({ where: { userId } });
  }
}

class PrismaEngagementRepository implements EngagementRepository {
  constructor(private db: Db) {}
  async markActivity(userId: string, day: string, kind: string) {
    await this.db.userActivity.upsert({
      where: { userId_day_kind: { userId, day: dayToDate(day), kind } },
      create: { userId, day: dayToDate(day), kind },
      update: {},
    });
  }
  async listActivity(userId: string, sinceDay: string) {
    const rows = await this.db.userActivity.findMany({
      where: { userId, day: { gte: dayToDate(sinceDay) } },
      select: { day: true, kind: true },
    });
    return rows.map((r) => ({ day: dateToDay(r.day), kind: r.kind }));
  }
  async listActivityForUsers(userIds: string[], sinceDay: string) {
    if (userIds.length === 0) return [];
    const rows = await this.db.userActivity.findMany({
      where: { userId: { in: userIds }, day: { gte: dayToDate(sinceDay) } },
      select: { userId: true, day: true, kind: true },
    });
    return rows.map((r) => ({ userId: r.userId, day: dateToDay(r.day), kind: r.kind }));
  }
  countActivity(userId: string) {
    return this.db.userActivity.count({ where: { userId } });
  }
  async getFriendCode(userId: string) {
    return (await this.db.friendCode.findUnique({ where: { userId } }))?.code ?? null;
  }
  async setFriendCode(userId: string, code: string) {
    await this.db.friendCode.upsert({ where: { userId }, create: { userId, code }, update: { code } });
  }
  async findUserByFriendCode(code: string) {
    return (await this.db.friendCode.findUnique({ where: { code } }))?.userId ?? null;
  }
  async createFriendRequest(requesterId: string, addresseeId: string) {
    const inserted = await this.db.friendRequest.createMany({
      data: [{ requesterId, addresseeId }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) {
      // Já existia: se foi respondido (recusado/aceito e depois desfeito), reabre; pendente fica como está.
      const reopened = await this.db.friendRequest.updateMany({
        where: { requesterId, addresseeId, status: { not: 'PENDING' } },
        data: { status: 'PENDING', createdAt: new Date(), respondedAt: null },
      });
      const request = await this.db.friendRequest.findUniqueOrThrow({
        where: { requesterId_addresseeId: { requesterId, addresseeId } },
      });
      return { request: request as FriendRequest, created: reopened.count === 1 };
    }
    const request = await this.db.friendRequest.findUniqueOrThrow({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
    });
    return { request: request as FriendRequest, created: true };
  }
  async findFriendRequest(a: string, b: string) {
    return (await this.db.friendRequest.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    })) as FriendRequest | null;
  }
  async listIncomingFriendRequests(userId: string) {
    return (await this.db.friendRequest.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })) as FriendRequest[];
  }
  async listOutgoingFriendRequests(userId: string) {
    return (await this.db.friendRequest.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })) as FriendRequest[];
  }
  async respondFriendRequest(id: string, userId: string, accept: boolean, at: Date) {
    return inTx(this.db, async (tx) => {
      // UPDATE condicional: só um "aceitar/recusar" ganha, e só quem recebeu o pedido.
      const won = await tx.friendRequest.updateMany({
        where: { id, addresseeId: userId, status: 'PENDING' },
        data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: at },
      });
      if (won.count !== 1) return null;
      const request = await tx.friendRequest.findUniqueOrThrow({ where: { id } });
      if (accept) {
        await tx.friendship.createMany({
          data: [
            { userId: request.requesterId, friendId: request.addresseeId },
            { userId: request.addresseeId, friendId: request.requesterId },
          ],
          skipDuplicates: true,
        });
      }
      return request as FriendRequest;
    });
  }
  async addFriend(a: string, b: string) {
    await this.db.friendship.createMany({
      data: [
        { userId: a, friendId: b },
        { userId: b, friendId: a },
      ],
      skipDuplicates: true,
    });
  }
  async removeFriend(a: string, b: string) {
    await this.db.friendship.deleteMany({
      where: {
        OR: [
          { userId: a, friendId: b },
          { userId: b, friendId: a },
        ],
      },
    });
  }
  async listFriendIds(userId: string) {
    return (await this.db.friendship.findMany({ where: { userId }, select: { friendId: true } })).map(
      (f) => f.friendId,
    );
  }
  async savePush(sub: PushSub) {
    // O endpoint é a "chave" da inscrição: quem o conhece não pode tomar a inscrição de outra pessoa.
    const existing = await this.db.pushSubscription.findUnique({ where: { endpoint: sub.endpoint } });
    if (existing && existing.userId !== sub.userId) throw new ForbiddenError('Esse aparelho já está em outra conta.');
    try {
      await this.db.pushSubscription.upsert({
        where: { endpoint: sub.endpoint },
        create: sub,
        // sem userId no update: nunca troca o dono
        update: { p256dh: sub.p256dh, auth: sub.auth },
      });
    } catch (err) {
      // Corrida: outra pessoa criou o mesmo endpoint entre o find e o create.
      if ((err as { code?: string }).code === 'P2002')
        throw new ForbiddenError('Esse aparelho já está em outra conta.');
      throw err;
    }
  }
  async deletePush(endpoint: string) {
    await this.db.pushSubscription.deleteMany({ where: { endpoint } });
  }
  listPush(userId: string) {
    return this.db.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, userId: true, p256dh: true, auth: true },
    });
  }
  async listPushUserIds() {
    return (await this.db.pushSubscription.findMany({ distinct: ['userId'], select: { userId: true } })).map(
      (p) => p.userId,
    );
  }
  async claimNotification(userId: string, key: string) {
    const r = await this.db.sentNotification.createMany({ data: [{ userId, key }], skipDuplicates: true });
    return r.count === 1;
  }
}

class PrismaPeopleRepository implements PeopleRepository {
  constructor(private db: Db) {}
  listByUser(userId: string): Promise<Person[]> {
    return this.db.person.findMany({ where: { userId }, orderBy: { name: 'asc' } });
  }
  findById(id: string): Promise<Person | null> {
    return this.db.person.findUnique({ where: { id } });
  }
  findByName(userId: string, name: string): Promise<Person | null> {
    return this.db.person.findFirst({ where: { userId, name: { equals: name, mode: 'insensitive' } } });
  }
  create(data: { userId: string; name: string }): Promise<Person> {
    return this.db.person.create({ data });
  }
  rename(id: string, name: string): Promise<Person> {
    return this.db.person.update({ where: { id }, data: { name } });
  }
  async delete(id: string) {
    await this.db.person.delete({ where: { id } });
  }
}

const mapInsight = (row: {
  id: string;
  userId: string;
  routine: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  payload: unknown;
  dedupeKey: string;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  actedAt: Date | null;
}): TostaoInsight => ({
  id: row.id,
  userId: row.userId,
  routine: row.routine as TostaoInsight['routine'],
  kind: row.kind,
  severity: row.severity as TostaoInsight['severity'],
  title: row.title,
  body: row.body,
  payload: (row.payload ?? {}) as Record<string, unknown>,
  dedupeKey: row.dedupeKey,
  status: row.status as TostaoInsightStatus,
  expiresAt: row.expiresAt,
  createdAt: row.createdAt,
  actedAt: row.actedAt,
});

/** Quantos achados a tela lê de uma vez (os mais recentes). */
const INSIGHTS_LIMIT = 50;

class PrismaTostaoAutoRepository implements TostaoAutoRepository {
  constructor(private db: Db) {}

  async listByUser(userId: string, opts: { now?: Date; limit?: number } = {}) {
    const now = opts.now ?? new Date();
    // Achado vencido não aparece (e o histórico vitalício não vai inteiro pra memória): filtro e teto no SQL.
    const rows = await this.db.tostaoInsight.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? INSIGHTS_LIMIT,
    });
    return rows.map(mapInsight);
  }
  async listWhatsappNotifiableUserIds({ after, limit }: { after?: string | null; limit: number }) {
    const rows = await this.db.tostaoAutoConfig.findMany({
      where: {
        notifyWhatsapp: true,
        user: { whatsapp: { is: { phone: { not: null } } } },
        ...(after ? { userId: { gt: after } } : {}),
      },
      select: { userId: true },
      orderBy: { userId: 'asc' },
      take: limit,
    });
    return rows.map((r) => r.userId);
  }

  async findById(id: string) {
    const row = await this.db.tostaoInsight.findUnique({ where: { id } });
    return row ? mapInsight(row) : null;
  }

  async upsertPending(data: UpsertTostaoInsight) {
    const payloadJson = data.payload as Prisma.InputJsonObject;
    return inTx(this.db, async (tx) => {
      // Criação atômica: INSERT ... ON CONFLICT DO NOTHING no unique (userId, dedupeKey). Duas rotinas ao mesmo
      // tempo não criam dois achados nem estouram P2002: quem perdeu cai no caminho "já existe" abaixo.
      const inserted = await tx.tostaoInsight.createMany({
        data: [
          {
            userId: data.userId,
            routine: data.routine,
            kind: data.kind,
            severity: data.severity,
            title: data.title,
            body: data.body,
            payload: payloadJson,
            dedupeKey: data.dedupeKey,
            status: 'PENDING',
            expiresAt: data.expiresAt ?? null,
          },
        ],
        skipDuplicates: true,
      });
      const existing = await tx.tostaoInsight.findUniqueOrThrow({
        where: { userId_dedupeKey: { userId: data.userId, dedupeKey: data.dedupeKey } },
      });
      if (inserted.count === 1) return { insight: mapInsight(existing), created: true };

      const prevPayload = (existing.payload ?? {}) as Record<string, unknown>;
      const reopenUncat = shouldReopenInsight({ status: existing.status, payload: prevPayload }, data);

      if (existing.status === 'PENDING' || reopenUncat) {
        const updated = await tx.tostaoInsight.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            body: data.body,
            severity: data.severity,
            payload: payloadJson,
            expiresAt: data.expiresAt ?? null,
            status: 'PENDING',
            actedAt: null,
          },
        });
        return { insight: mapInsight(updated), created: reopenUncat };
      }
      return { insight: mapInsight(existing), created: false };
    });
  }

  async setStatus(id: string, status: TostaoInsightStatus, actedAt: Date | null) {
    const updated = await this.db.tostaoInsight.update({ where: { id }, data: { status, actedAt } });
    return mapInsight(updated);
  }

  async getConfig(userId: string): Promise<TostaoAutoConfig> {
    const row = await this.db.tostaoAutoConfig.findUnique({ where: { userId } });
    if (row) return row;
    return {
      userId,
      carameloExtrato: true,
      tostaoPrevisao: true,
      guardiaoLimites: true,
      olheiroAcertos: true,
      notifyPush: true,
      notifyWhatsapp: false,
      lastCheckedAt: null,
      updatedAt: new Date(0),
    };
  }

  async updateConfig(
    userId: string,
    patch: UpdateTostaoAutoConfigBody & { lastCheckedAt?: Date },
  ): Promise<TostaoAutoConfig> {
    return this.db.tostaoAutoConfig.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: patch,
    });
  }
}

class PrismaOutboxRepository implements OutboxRepository {
  constructor(private db: Db) {}
  async enqueue(job: NewOutboxJob): Promise<OutboxJob> {
    const row = await this.db.outboxJob.create({
      data: {
        type: job.type,
        payload: job.payload as Prisma.InputJsonObject,
        ...(job.runAt ? { runAt: job.runAt } : {}),
        ...(job.maxAttempts ? { maxAttempts: job.maxAttempts } : {}),
      },
    });
    return row as unknown as OutboxJob;
  }
  async claimDue(now: Date, limit: number, lockTimeoutMs = 10 * 60_000): Promise<OutboxJob[]> {
    const staleBefore = new Date(now.getTime() - lockTimeoutMs);
    return inTx(this.db, async (tx) => {
      const due = await tx.outboxJob.findMany({
        where: { status: 'PENDING', runAt: { lte: now }, OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }] },
        orderBy: { runAt: 'asc' },
        take: limit,
      });
      const mine: OutboxJob[] = [];
      for (const job of due) {
        // UPDATE condicional: se outro worker pegou entre o SELECT e aqui, count = 0 e pulamos.
        const won = await tx.outboxJob.updateMany({
          where: { id: job.id, status: 'PENDING', OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }] },
          data: { lockedAt: now, attempts: { increment: 1 } },
        });
        if (won.count === 1) mine.push({ ...(job as unknown as OutboxJob), lockedAt: now, attempts: job.attempts + 1 });
      }
      return mine;
    });
  }
  async markDone(id: string, now: Date) {
    await this.db.outboxJob.update({
      where: { id },
      data: { status: 'DONE', processedAt: now, lockedAt: null, lastError: null },
    });
  }
  async markAttemptFailed(id: string, error: string, nextRunAt: Date | null) {
    await this.db.outboxJob.update({
      where: { id },
      data: nextRunAt
        ? { lastError: error.slice(0, 500), lockedAt: null, runAt: nextRunAt }
        : { lastError: error.slice(0, 500), lockedAt: null, status: 'FAILED' },
    });
  }
}

class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private db: Db) {}
  async record(e: NewAuditLog) {
    await this.db.auditLog.create({
      data: {
        userId: e.userId ?? null,
        action: e.action,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        metadata: (e.metadata ?? undefined) as Prisma.InputJsonObject | undefined,
        ipAddress: e.ipAddress ?? null,
      },
    });
  }
}

class PrismaUserConsentsRepository implements UserConsentsRepository {
  constructor(private db: Db) {}
  async grant({ userId, type, version, at }: { userId: string; type: UserConsent['type']; version: string; at: Date }) {
    await inTx(this.db, async (tx) => {
      await tx.userConsent.updateMany({ where: { userId, type, revokedAt: null }, data: { revokedAt: at } });
      await tx.userConsent.create({ data: { userId, type, version, grantedAt: at } });
    });
  }
  async revoke(userId: string, type: UserConsent['type'], at: Date) {
    await this.db.userConsent.updateMany({ where: { userId, type, revokedAt: null }, data: { revokedAt: at } });
  }
  async listByUser(userId: string) {
    return (await this.db.userConsent.findMany({ where: { userId }, orderBy: { grantedAt: 'asc' } })) as UserConsent[];
  }
}

export function makePrismaRepositories(db: Db): Repositories {
  const repos: Repositories = {
    // Dentro de uma transação já aberta o Prisma não aninha: reaproveita a mesma.
    tx: (fn) => inTx(db, (tx) => fn(makePrismaRepositories(tx))),
    outbox: new PrismaOutboxRepository(db),
    audit: new PrismaAuditLogRepository(db),
    consents: new PrismaUserConsentsRepository(db),
    users: new PrismaUsersRepository(db),
    oauthAccounts: new PrismaOAuthAccountsRepository(db),
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
    refreshTokens: new PrismaRefreshTokensRepository(db),
    emailVerifications: new PrismaEmailVerificationTokensRepository(db),
    chat: new PrismaChatMessagesRepository(db),
    plans: new PrismaFinancialPlansRepository(db),
    whatsapp: new PrismaWhatsappLinksRepository(db),
    games: new PrismaGamesRepository(db),
    engagement: new PrismaEngagementRepository(db),
    people: new PrismaPeopleRepository(db),
    tostaoAuto: new PrismaTostaoAutoRepository(db),
    reconciledNotes: new PrismaReconciledNotesRepository(db),
  };
  return repos;
}
