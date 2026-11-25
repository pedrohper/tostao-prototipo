// Repositórios em memória: arrays simples. Usados nos testes e pra rodar sem Postgres.
import { randomUUID } from 'node:crypto';
import { ConflictError, ForbiddenError } from '../../domain/errors.js';
import type {
  Account,
  BankConnection,
  Category,
  CategoryBudget,
  CategoryRule,
  LessonProgress,
  Transaction,
  User,
  Invite,
  PasswordReset,
  RefreshToken,
  EmailVerificationToken,
  ChatMessage,
  TribunalVote,
  FriendRequest,
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
  AuditLog,
  RecurringRule,
  AutomationToken,
} from '../../domain/entities.js';
import {
  isYieldTransaction,
  type FinancialPlan,
  type StoredHomePrefs,
  type UpdateTostaoAutoConfigBody,
} from '@tostao/contracts';
import type {
  AccountData,
  NewUser,
  AccountsRepository,
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
  PeopleRepository,
  Repositories,
  RecurringRulesRepository,
  NewRecurringRule,
  AutomationTokensRepository,
  TransactionsRepository,
  UsersRepository,
  NewOAuthAccount,
  OAuthAccountsRepository,
  WhatsappLink,
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
  PersonBalance,
  TransactionSearchFilter,
  TransactionSearchResult,
} from '../types.js';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../../lib/defaults.js';
import { shouldReopenInsight } from '../../services/insight-reopen.js';

export class InMemoryOAuthAccountsRepository implements OAuthAccountsRepository {
  items: OAuthAccount[] = [];
  async findByProviderAccount(provider: OAuthProvider, providerAccountId: string) {
    return this.items.find((a) => a.provider === provider && a.providerAccountId === providerAccountId) ?? null;
  }
  async listByUser(userId: string) {
    return this.items.filter((a) => a.userId === userId);
  }
  async create(data: NewOAuthAccount) {
    const account: OAuthAccount = { id: randomUUID(), createdAt: new Date(), ...data };
    this.items.push(account);
    return account;
  }
}

export class InMemoryUsersRepository implements UsersRepository {
  items: User[] = [];
  constructor(
    private readonly cascade?: {
      oauthAccounts: InMemoryOAuthAccountsRepository;
      refreshTokens?: InMemoryRefreshTokensRepository;
    },
  ) {}
  async findByEmail(email: string) {
    return this.items.find((u) => u.email === email) ?? null;
  }
  async findById(id: string) {
    return this.items.find((u) => u.id === id) ?? null;
  }
  async listAllIds() {
    return this.items.map((u) => u.id);
  }
  async findManyByIds(ids: string[]) {
    const wanted = new Set(ids);
    return this.items.filter((u) => wanted.has(u.id));
  }
  async create(data: NewUser) {
    const user: User = {
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
      termsAcceptedAt: data.termsAcceptedAt ?? null,
      termsVersion: data.termsVersion ?? null,
      aiConsentAt: null,
      pixKey: null,
      homePrefs: null,
      timezone: 'America/Sao_Paulo',
    };
    this.items.push(user);
    return user;
  }
  async count() {
    return this.items.length;
  }
  async updatePassword(id: string, passwordHash: string) {
    const u = this.items.find((x) => x.id === id);
    if (u) u.passwordHash = passwordHash;
  }
  async markEmailVerified(id: string, at: Date) {
    const u = this.items.find((x) => x.id === id);
    if (u && !u.emailVerifiedAt) u.emailVerifiedAt = at;
  }
  async setAiConsent(id: string, at: Date | null) {
    const u = this.items.find((x) => x.id === id);
    if (u) u.aiConsentAt = at;
  }
  async setPixKey(id: string, pixKey: string | null) {
    const u = this.items.find((x) => x.id === id);
    if (u) u.pixKey = pixKey;
  }
  async updateHomePrefs(id: string, change: (current: unknown) => StoredHomePrefs) {
    const u = this.items.find((x) => x.id === id);
    if (!u) return null;
    const next = change(u.homePrefs); // sem `await` no meio: aqui já é atômico
    u.homePrefs = next;
    return next;
  }
  async delete(id: string) {
    this.items = this.items.filter((u) => u.id !== id);
    if (this.cascade) {
      this.cascade.oauthAccounts.items = this.cascade.oauthAccounts.items.filter((a) => a.userId !== id);
      if (this.cascade.refreshTokens) {
        this.cascade.refreshTokens.items = this.cascade.refreshTokens.items.filter((t) => t.userId !== id);
      }
    }
  }
}

export class InMemoryBankConnectionsRepository implements BankConnectionsRepository {
  items: BankConnection[] = [];
  // Imita o onDelete: Cascade do Postgres
  constructor(
    private readonly cascade?: { accounts: InMemoryAccountsRepository; transactions: InMemoryTransactionsRepository },
  ) {}
  async findById(id: string) {
    return this.items.find((c) => c.id === id) ?? null;
  }
  async findByUserAndItem(userId: string, itemId: string) {
    return this.items.find((c) => c.userId === userId && c.itemId === itemId) ?? null;
  }
  async findByItemId(itemId: string) {
    return this.items.find((c) => c.itemId === itemId) ?? null;
  }
  async listByUser(userId: string) {
    return this.items.filter((c) => c.userId === userId);
  }
  async listActive() {
    return this.items.filter((c) => c.status === 'ACTIVE');
  }
  async create(data: Pick<BankConnection, 'userId' | 'itemId' | 'institution'>) {
    // Imita o índice único parcial do Postgres: Item do Open Finance é de uma pessoa só (import:/manual: são por usuário).
    if (!/^(import|manual):/.test(data.itemId) && this.items.some((c) => c.itemId === data.itemId))
      throw new ConflictError('Essa conexão não está disponível.');
    const c: BankConnection = {
      id: randomUUID(),
      status: 'ACTIVE',
      lastSyncedAt: null,
      errorCount: 0,
      lastErrorAt: null,
      createdAt: new Date(),
      ...data,
    };
    this.items.push(c);
    return c;
  }
  async listRetryable(before: Date) {
    return this.items.filter((c) => c.status === 'ERROR' && (!c.lastErrorAt || c.lastErrorAt <= before));
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
    // Imita transactions.account_id ON DELETE SET NULL: quem apaga o lançamento do banco é o DisconnectBankUseCase.
    for (const t of this.cascade.transactions.items) if (t.accountId && gone.has(t.accountId)) t.accountId = null;
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
    if (this.transactions) for (const t of this.transactions.items) if (t.accountId === id) t.accountId = null; // SET NULL
  }
  async setHidden(id: string, hidden: boolean) {
    const a = this.items.find((x) => x.id === id);
    if (a) a.hidden = hidden;
  }
  async adjustBalance(id: string, deltaInCents: number) {
    const a = this.items.find((x) => x.id === id);
    if (a) a.balanceInCents += deltaInCents;
  }
  async upsertByExternalId(data: AccountData) {
    const found = this.items.find((a) => a.userId === data.userId && a.externalId === data.externalId);
    if (found) {
      Object.assign(found, data);
      return found;
    }
    const a: Account = { id: randomUUID(), hidden: false, creditLimitInCents: null, dueDate: null, ...data };
    this.items.push(a);
    return a;
  }
  async listByUser(userId: string) {
    return this.items.filter((a) => a.userId === userId);
  }
}

export class InMemoryCategoriesRepository implements CategoriesRepository {
  items: Category[] = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  async list(userId?: string) {
    return this.items.filter((c) => !c.userId || c.userId === userId);
  }
  async findById(id: string) {
    return this.items.find((c) => c.id === id) ?? null;
  }
  async create(data: Omit<Category, 'id'> & { userId: string }) {
    const c: Category = { id: `u-${randomUUID()}`, ...data };
    this.items.push(c);
    return c;
  }
  async delete(id: string) {
    this.items = this.items.filter((c) => c.id !== id);
  }
}

export class InMemoryCategoryRulesRepository implements CategoryRulesRepository {
  items: CategoryRule[] = DEFAULT_RULES.map((r) => ({ id: randomUUID(), userId: null, ...r }));
  async listForUser(userId: string) {
    return this.items.filter((r) => r.userId === null || r.userId === userId);
  }
  async upsert(data: Omit<CategoryRule, 'id'>) {
    const found = this.items.find((r) => r.userId === data.userId && r.pattern === data.pattern);
    if (found) {
      found.categoryId = data.categoryId;
      return found;
    }
    const r: CategoryRule = { id: randomUUID(), ...data };
    this.items.push(r);
    return r;
  }
  async deleteByCategory(userId: string, categoryId: string) {
    this.items = this.items.filter((r) => !(r.userId === userId && r.categoryId === categoryId));
  }
}

export class InMemoryTransactionsRepository implements TransactionsRepository {
  items: Transaction[] = [];
  /** Ligado pelo makeInMemoryRepositories: deleteBankByConnection precisa saber quais contas são da conexão. */
  accounts?: { items: Account[] };
  /** Ligado pelo makeInMemoryRepositories: a busca casa palavra com o nome da categoria. */
  categories?: { items: Category[] };
  async findById(id: string) {
    return this.items.find((t) => t.id === id) ?? null;
  }
  async findByExternalId(userId: string, externalId: string) {
    return this.items.find((t) => t.userId === userId && t.externalId === externalId) ?? null;
  }
  async findByExternalIds(userId: string, externalIds: string[]) {
    const wanted = new Set(externalIds);
    return this.items.filter((t) => t.userId === userId && t.externalId !== null && wanted.has(t.externalId));
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
  async findBalancePending(now: Date, limit: number) {
    const manual = new Set(
      (this.accounts?.items ?? []).filter((a) => a.externalId.startsWith('manual:')).map((a) => a.id),
    );
    return this.items
      .filter((t) => !t.balanceAppliedAt && t.accountId && manual.has(t.accountId) && t.occurredAt <= now)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
  async claimBalanceApplication(id: string, at: Date) {
    const t = this.items.find((x) => x.id === id);
    if (!t || t.balanceAppliedAt) return false;
    t.balanceAppliedAt = at;
    return true;
  }
  async createMany(
    data: (Omit<Transaction, 'id' | 'createdAt'> & { id?: string })[],
    opts?: { skipDuplicates?: boolean },
  ) {
    let created = 0;
    for (const d of data) {
      if (
        opts?.skipDuplicates &&
        d.externalId !== null &&
        this.items.some((t) => t.userId === d.userId && t.externalId === d.externalId)
      )
        continue;
      this.items.push({ id: randomUUID(), createdAt: new Date(), ...d });
      created++;
    }
    return created;
  }
  async setInternalTransfer(userId: string, ids: string[], isInternalTransfer: boolean) {
    const wanted = new Set(ids);
    let changed = 0;
    for (const t of this.items)
      if (t.userId === userId && wanted.has(t.id)) {
        t.isInternalTransfer = isInternalTransfer;
        changed++;
      }
    return changed;
  }
  async categorizeUncategorized(userId: string, ids: string[], categoryId: string) {
    const wanted = new Set(ids);
    let changed = 0;
    for (const t of this.items)
      if (t.userId === userId && wanted.has(t.id) && !t.categoryId) {
        t.categoryId = categoryId;
        changed++;
      }
    return changed;
  }
  /** Mesma regra do Postgres (ILIKE: minúsculas, mas ACENTO conta), pra os testes valerem pros dois. */
  async search(userId: string, f: TransactionSearchFilter): Promise<TransactionSearchResult> {
    const hidden = new Set((this.accounts?.items ?? []).filter((a) => a.hidden).map((a) => a.id));
    const accountName = new Map((this.accounts?.items ?? []).map((a) => [a.id, a.name.toLowerCase()]));
    const categoryName = new Map((this.categories?.items ?? []).map((c) => [c.id, c.name.toLowerCase()]));
    const matches = this.items
      .filter((t) => t.userId === userId && (!f.from || t.occurredAt >= f.from) && t.occurredAt < f.to)
      .filter((t) => !(t.accountId && hidden.has(t.accountId)))
      .filter((t) => !f.excludeTransfers || !t.isInternalTransfer)
      .filter((t) => !f.excludeYields || !isYieldTransaction(t))
      .filter((t) => (f.kind === 'saida' ? t.amountInCents < 0 : f.kind === 'entrada' ? t.amountInCents > 0 : true))
      .filter((t) => !f.categoryId || (f.categoryId === 'sem' ? !t.categoryId : t.categoryId === f.categoryId))
      .filter((t) =>
        f.words.every((w) =>
          [
            t.description.toLowerCase(),
            t.categoryId ? (categoryName.get(t.categoryId) ?? '') : '',
            t.accountId ? (accountName.get(t.accountId) ?? '') : '',
          ].some((text) => text.includes(w)),
        ),
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || (a.id < b.id ? 1 : -1));
    const after = f.cursor
      ? matches.filter(
          (t) =>
            t.occurredAt < f.cursor!.occurredAt ||
            (t.occurredAt.getTime() === f.cursor!.occurredAt.getTime() && t.id < f.cursor!.id),
        )
      : matches;
    const page = after.slice(0, f.limit);
    const last = page.at(-1);
    const counted = matches.filter((t) => !t.isInternalTransfer);
    return {
      transactions: page,
      nextCursor: after.length > f.limit && last ? { occurredAt: last.occurredAt, id: last.id } : null,
      count: matches.length,
      outInCents: counted.filter((t) => t.amountInCents < 0).reduce((s, t) => s - t.amountInCents, 0),
      inInCents: counted.filter((t) => t.amountInCents > 0).reduce((s, t) => s + t.amountInCents, 0),
    };
  }
  async summarizeByPerson(userId: string): Promise<PersonBalance[]> {
    const by = new Map<string, PersonBalance>();
    for (const t of this.items) {
      if (t.userId !== userId || !t.personId) continue;
      const cur = by.get(t.personId) ?? { personId: t.personId, balanceInCents: 0, count: 0, lastAt: null };
      cur.balanceInCents -= t.amountInCents;
      cur.count++;
      if (!cur.lastAt || t.occurredAt > cur.lastAt) cur.lastAt = t.occurredAt;
      by.set(t.personId, cur);
    }
    return [...by.values()];
  }
  async clearCategory(userId: string, categoryId: string) {
    for (const t of this.items) if (t.userId === userId && t.categoryId === categoryId) t.categoryId = null;
  }
  async deleteBankByAccount(userId: string, accountId: string) {
    const before = this.items.length;
    this.items = this.items.filter((t) => !(t.userId === userId && t.accountId === accountId && t.externalId !== null));
    return before - this.items.length;
  }
  async deleteBankByConnection(userId: string, connectionId: string) {
    const accountIds = new Set(
      (this.accounts?.items ?? [])
        .filter((a) => a.userId === userId && a.connectionId === connectionId)
        .map((a) => a.id),
    );
    const before = this.items.length;
    this.items = this.items.filter(
      (t) => !(t.userId === userId && t.externalId !== null && t.accountId && accountIds.has(t.accountId)),
    );
    return before - this.items.length;
  }
  async delete(id: string) {
    this.items = this.items.filter((t) => t.id !== id);
  }
  async findManualByUser(userId: string) {
    return this.items
      .filter((t) => t.userId === userId && t.externalId === null)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
  async findByPerson(userId: string, personId: string) {
    return this.items
      .filter((t) => t.userId === userId && t.personId === personId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }
  async deleteSeriesFrom(userId: string, seriesId: string, from: Date) {
    const before = this.items.length;
    this.items = this.items.filter((t) => !(t.userId === userId && t.seriesId === seriesId && t.occurredAt >= from));
    return before - this.items.length;
  }
}

export class InMemoryReconciledNotesRepository implements ReconciledNotesRepository {
  items: ReconciledNote[] = [];
  async create(data: NewReconciledNote, at: Date = new Date()) {
    const row: ReconciledNote = { id: randomUUID(), reconciledAt: at, ...data };
    this.items.push(row);
    return row;
  }
  async listByUser(userId: string, limit = 100) {
    return this.items
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.reconciledAt.getTime() - a.reconciledAt.getTime())
      .slice(0, limit);
  }
}

export class InMemoryBudgetsRepository implements BudgetsRepository {
  items: CategoryBudget[] = [];
  async listByUser(userId: string) {
    return this.items.filter((b) => b.userId === userId);
  }
  async upsert(data: Omit<CategoryBudget, 'id'>) {
    const found = this.items.find((b) => b.userId === data.userId && b.categoryId === data.categoryId);
    if (found) {
      found.limitInCents = data.limitInCents;
      return found;
    }
    const b: CategoryBudget = { id: randomUUID(), ...data };
    this.items.push(b);
    return b;
  }
  async delete(userId: string, categoryId: string) {
    this.items = this.items.filter((b) => !(b.userId === userId && b.categoryId === categoryId));
  }
  async deleteByCategory(userId: string, categoryId: string) {
    this.items = this.items.filter((b) => !(b.userId === userId && b.categoryId === categoryId));
  }
}

export class InMemoryLessonProgressRepository implements LessonProgressRepository {
  items: LessonProgress[] = [];
  async listByUser(userId: string) {
    return this.items.filter((l) => l.userId === userId);
  }
  async listByUsers(userIds: string[]) {
    const wanted = new Set(userIds);
    return this.items.filter((l) => wanted.has(l.userId));
  }
  async markDone(userId: string, lessonId: string) {
    if (!this.items.some((l) => l.userId === userId && l.lessonId === lessonId))
      this.items.push({ userId, lessonId, completedAt: new Date() });
  }
}

export class InMemoryGamesRepository implements GamesRepository {
  votes: TribunalVote[] = [];
  battles: Battle[] = [];
  async vote(userId: string, caseId: string, weekKey: string, choice: number) {
    // Sem await entre checar e gravar: atômico em JS. Voto já dado nessa semana nunca é trocado.
    if (this.votes.some((v) => v.userId === userId && v.caseId === caseId && v.weekKey === weekKey)) return false;
    this.votes.push({ userId, caseId, weekKey, choice, votedAt: new Date() });
    return true;
  }
  async findVote(userId: string, caseId: string, weekKey: string) {
    return this.votes.find((v) => v.userId === userId && v.caseId === caseId && v.weekKey === weekKey) ?? null;
  }
  async countVotes(caseId: string, weekKey: string) {
    const counts: number[] = [];
    for (const v of this.votes.filter((x) => x.caseId === caseId && x.weekKey === weekKey))
      counts[v.choice] = (counts[v.choice] ?? 0) + 1;
    return Array.from(counts, (c) => c ?? 0);
  }
  async countUserVotes(userId: string) {
    return this.votes.filter((v) => v.userId === userId).length;
  }
  async listBattles(userId: string) {
    return this.battles.filter((b) => b.userId === userId);
  }
  async saveBattle(battle: Battle) {
    this.battles = this.battles.filter((b) => !(b.userId === battle.userId && b.kind === battle.kind));
    this.battles.push({ ...battle });
  }
  async findBattle(userId: string, kind: BattleKind) {
    return this.battles.find((b) => b.userId === userId && b.kind === kind) ?? null;
  }
  async mutateBattle(userId: string, kind: BattleKind, fn: (current: Battle | null) => Battle) {
    const next = fn(this.battles.find((b) => b.userId === userId && b.kind === kind) ?? null);
    this.battles = this.battles.filter((b) => !(b.userId === userId && b.kind === kind));
    this.battles.push({ ...next });
    return next;
  }
}

export class InMemoryIgnoredSubscriptionsRepository implements IgnoredSubscriptionsRepository {
  items: { userId: string; key: string }[] = [];
  async listKeys(userId: string) {
    return this.items.filter((i) => i.userId === userId).map((i) => i.key);
  }
  async set(userId: string, key: string, ignored: boolean) {
    this.items = this.items.filter((i) => !(i.userId === userId && i.key === key));
    if (ignored) this.items.push({ userId, key });
  }
}

export class InMemoryInvitesRepository implements InvitesRepository {
  items: Invite[] = [];
  async create(data: { code: string; createdById: string | null }) {
    const i: Invite = { ...data, usedById: null, createdAt: new Date(), usedAt: null };
    this.items.push(i);
    return i;
  }
  async findByCode(code: string) {
    return this.items.find((i) => i.code === code) ?? null;
  }
  async markUsed(code: string, userId: string) {
    const i = this.items.find((x) => x.code === code);
    if (!i || i.usedAt) return false; // o que manda é usedAt: convite usado nunca reabre
    Object.assign(i, { usedById: userId, usedAt: new Date() });
    return true;
  }
  async listByCreator(userId: string) {
    return this.items.filter((i) => i.createdById === userId).reverse();
  }
}

// Os métodos abaixo não têm `await` no meio da checagem + gravação: em JS isso já é atômico (um por vez),
// o equivalente em memória do UPDATE condicional / $transaction do Postgres.
export class InMemoryPasswordResetsRepository implements PasswordResetsRepository {
  items: PasswordReset[] = [];
  constructor(
    private readonly users: InMemoryUsersRepository,
    private readonly refreshTokens: InMemoryRefreshTokensRepository,
  ) {}
  async findByTokenHash(tokenHash: string) {
    return this.items.find((r) => r.tokenHash === tokenHash) ?? null;
  }
  async replacePending(data: { userId: string; tokenHash: string; expiresAt: Date }, now: Date) {
    for (const r of this.items) if (r.userId === data.userId && !r.usedAt) r.usedAt = now;
    const r: PasswordReset = { id: randomUUID(), usedAt: null, ...data };
    this.items.push(r);
    return r;
  }
  async redeem({ tokenHash, passwordHash, now }: { tokenHash: string; passwordHash: string; now: Date }) {
    const reset = this.items.find((r) => r.tokenHash === tokenHash);
    if (!reset || reset.usedAt || reset.expiresAt <= now) return null;
    reset.usedAt = now;
    const user = this.users.items.find((u) => u.id === reset.userId);
    if (user) {
      user.passwordHash = passwordHash;
      if (!user.emailVerifiedAt) user.emailVerifiedAt = now;
    }
    for (const r of this.items) if (r.userId === reset.userId && !r.usedAt) r.usedAt = now;
    for (const t of this.refreshTokens.items) if (t.userId === reset.userId && !t.revokedAt) t.revokedAt = now;
    return { userId: reset.userId };
  }
}

export class InMemoryRefreshTokensRepository implements RefreshTokensRepository {
  items: RefreshToken[] = [];
  async create(data: NewRefreshToken) {
    const t: RefreshToken = { id: randomUUID(), createdAt: new Date(), revokedAt: null, replacedById: null, ...data };
    this.items.push(t);
    return t;
  }
  async rotate({
    tokenHash,
    now,
    next,
    graceMs = 0,
  }: {
    tokenHash: string;
    now: Date;
    next: Omit<NewRefreshToken, 'userId' | 'familyId'>;
    graceMs?: number;
  }): Promise<RotateRefreshResult> {
    const current = this.items.find((t) => t.tokenHash === tokenHash);
    if (!current) return { status: 'invalid' };
    if (!current.revokedAt && current.expiresAt > now) {
      // um ramo vivo só por família (mesma regra do Prisma): a troca normal mata os irmãos emitidos pela janela
      for (const t of this.items) if (t.familyId === current.familyId && !t.revokedAt) t.revokedAt = now;
      const created: RefreshToken = {
        id: randomUUID(),
        createdAt: now,
        revokedAt: null,
        replacedById: null,
        ...next,
        userId: current.userId,
        familyId: current.familyId,
      };
      this.items.push(created);
      current.replacedById = created.id;
      return { status: 'rotated', userId: current.userId, familyId: current.familyId };
    }
    if (current.revokedAt) {
      if (graceMs > 0 && current.replacedById && now.getTime() - current.revokedAt.getTime() <= graceMs) {
        const child = this.items.find((t) => t.id === current.replacedById);
        if (child && child.familyId === current.familyId && !child.revokedAt && child.expiresAt > now) {
          this.items.push({
            id: randomUUID(),
            createdAt: now,
            revokedAt: null,
            replacedById: null,
            ...next,
            userId: current.userId,
            familyId: current.familyId,
          });
          return { status: 'rotated', userId: current.userId, familyId: current.familyId, viaGrace: true };
        }
      }
      for (const t of this.items) if (t.familyId === current.familyId && !t.revokedAt) t.revokedAt = now;
      return { status: 'reused', userId: current.userId, familyId: current.familyId };
    }
    return { status: 'invalid' };
  }
  async revokeFamilyOf(tokenHash: string, now: Date) {
    const row = this.items.find((t) => t.tokenHash === tokenHash);
    if (!row) return;
    for (const t of this.items) if (t.familyId === row.familyId && !t.revokedAt) t.revokedAt = now;
  }
  async revokeAllForUser(userId: string, now: Date) {
    for (const t of this.items) if (t.userId === userId && !t.revokedAt) t.revokedAt = now;
  }
}

export class InMemoryEmailVerificationTokensRepository implements EmailVerificationTokensRepository {
  items: EmailVerificationToken[] = [];
  constructor(private readonly users: InMemoryUsersRepository) {}
  async replacePending(data: { userId: string; tokenHash: string; expiresAt: Date }, now: Date) {
    for (const r of this.items) if (r.userId === data.userId && !r.usedAt) r.usedAt = now;
    const t: EmailVerificationToken = { id: randomUUID(), usedAt: null, ...data };
    this.items.push(t);
    return t;
  }
  async consume({ tokenHash, now }: { tokenHash: string; now: Date }) {
    const t = this.items.find((x) => x.tokenHash === tokenHash);
    if (!t || t.usedAt || t.expiresAt <= now) return null;
    t.usedAt = now;
    const user = this.users.items.find((u) => u.id === t.userId);
    if (user && !user.emailVerifiedAt) user.emailVerifiedAt = now;
    return { userId: t.userId };
  }
}

export class InMemoryChatMessagesRepository implements ChatMessagesRepository {
  items: ChatMessage[] = [];
  async listRecent(userId: string, limit: number) {
    return this.items.filter((m) => m.userId === userId).slice(-limit);
  }
  async create(data: Omit<ChatMessage, 'id' | 'createdAt'>) {
    const m: ChatMessage = { id: randomUUID(), createdAt: new Date(), ...data };
    this.items.push(m);
    return m;
  }
  async countUserSince(userId: string, since: Date) {
    return this.items.filter((m) => m.userId === userId && m.role === 'user' && m.createdAt >= since).length;
  }
}

export class InMemoryFinancialPlansRepository implements FinancialPlansRepository {
  items = new Map<string, FinancialPlan>();
  async get(userId: string) {
    return this.items.get(userId) ?? null;
  }
  async save(userId: string, plan: FinancialPlan) {
    this.items.set(userId, plan);
  }
  async mutate(userId: string, fn: (current: FinancialPlan | null) => FinancialPlan) {
    // Sem await entre ler e gravar: atômico em JS (o lock por version só faz diferença no Postgres).
    const next = fn(this.items.get(userId) ?? null);
    this.items.set(userId, next);
    return next;
  }
}

export class InMemoryWhatsappLinksRepository implements WhatsappLinksRepository {
  items = new Map<string, WhatsappLink>();
  private row(userId: string) {
    return this.items.get(userId) ?? { userId, phone: null, codeHash: null, codeExpiresAt: null, linkedAt: null };
  }
  async get(userId: string) {
    return this.items.get(userId) ?? null;
  }
  async findByPhone(phone: string) {
    return [...this.items.values()].find((l) => l.phone === phone) ?? null;
  }
  async findByCodeHash(codeHash: string) {
    return [...this.items.values()].find((l) => l.codeHash === codeHash) ?? null;
  }
  async setCode(userId: string, codeHash: string, expiresAt: Date) {
    this.items.set(userId, { ...this.row(userId), codeHash, codeExpiresAt: expiresAt });
  }
  async link(userId: string, phone: string, at: Date) {
    // Igual ao @unique do Postgres: número de outra conta não é roubado.
    if ([...this.items.values()].some((l) => l.phone === phone && l.userId !== userId))
      throw new ConflictError('Esse número já está ligado a outra conta.');
    this.items.set(userId, { ...this.row(userId), phone, linkedAt: at, codeHash: null, codeExpiresAt: null });
  }
  async unlink(userId: string) {
    this.items.delete(userId);
  }
}

export class InMemoryEngagementRepository implements EngagementRepository {
  activity: { userId: string; day: string; kind: string }[] = [];
  codes = new Map<string, string>();
  friends: { userId: string; friendId: string }[] = [];
  push: PushSub[] = [];
  sent = new Set<string>();
  async markActivity(userId: string, day: string, kind: string) {
    if (!this.activity.some((a) => a.userId === userId && a.day === day && a.kind === kind))
      this.activity.push({ userId, day, kind });
  }
  async listActivityForUsers(userIds: string[], sinceDay: string) {
    const wanted = new Set(userIds);
    return this.activity.filter((a) => wanted.has(a.userId) && a.day >= sinceDay);
  }
  async listActivity(userId: string, sinceDay: string) {
    return this.activity
      .filter((a) => a.userId === userId && a.day >= sinceDay)
      .map(({ day, kind }) => ({ day, kind }));
  }
  async countActivity(userId: string) {
    return this.activity.filter((a) => a.userId === userId).length;
  }
  async getFriendCode(userId: string) {
    return this.codes.get(userId) ?? null;
  }
  async setFriendCode(userId: string, code: string) {
    this.codes.set(userId, code);
  }
  async findUserByFriendCode(code: string) {
    return [...this.codes].find(([, c]) => c === code)?.[0] ?? null;
  }
  requests: FriendRequest[] = [];
  async createFriendRequest(requesterId: string, addresseeId: string) {
    const existing = this.requests.find((r) => r.requesterId === requesterId && r.addresseeId === addresseeId);
    if (existing) {
      if (existing.status === 'PENDING') return { request: existing, created: false };
      // Recusado (ou amizade desfeita): dá pra pedir de novo.
      Object.assign(existing, { status: 'PENDING', createdAt: new Date(), respondedAt: null });
      return { request: existing, created: true };
    }
    const request: FriendRequest = {
      id: randomUUID(),
      requesterId,
      addresseeId,
      status: 'PENDING',
      createdAt: new Date(),
      respondedAt: null,
    };
    this.requests.push(request);
    return { request, created: true };
  }
  async findFriendRequest(a: string, b: string) {
    return (
      this.requests.find(
        (r) => (r.requesterId === a && r.addresseeId === b) || (r.requesterId === b && r.addresseeId === a),
      ) ?? null
    );
  }
  async listIncomingFriendRequests(userId: string) {
    return this.requests.filter((r) => r.addresseeId === userId && r.status === 'PENDING');
  }
  async listOutgoingFriendRequests(userId: string) {
    return this.requests.filter((r) => r.requesterId === userId && r.status === 'PENDING');
  }
  async respondFriendRequest(id: string, userId: string, accept: boolean, at: Date) {
    const r = this.requests.find((x) => x.id === id);
    if (!r || r.addresseeId !== userId || r.status !== 'PENDING') return null;
    r.status = accept ? 'ACCEPTED' : 'DECLINED';
    r.respondedAt = at;
    if (accept) await this.addFriend(r.requesterId, r.addresseeId);
    return r;
  }
  async addFriend(a: string, b: string) {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const)
      if (!this.friends.some((f) => f.userId === x && f.friendId === y)) this.friends.push({ userId: x, friendId: y });
  }
  async removeFriend(a: string, b: string) {
    this.friends = this.friends.filter(
      (f) => !((f.userId === a && f.friendId === b) || (f.userId === b && f.friendId === a)),
    );
  }
  async listFriendIds(userId: string) {
    return this.friends.filter((f) => f.userId === userId).map((f) => f.friendId);
  }
  async savePush(sub: PushSub) {
    const existing = this.push.find((p) => p.endpoint === sub.endpoint);
    if (existing && existing.userId !== sub.userId) throw new ForbiddenError('Esse aparelho já está em outra conta.');
    this.push = [...this.push.filter((p) => p.endpoint !== sub.endpoint), sub];
  }
  async deletePush(endpoint: string) {
    this.push = this.push.filter((p) => p.endpoint !== endpoint);
  }
  async listPush(userId: string) {
    return this.push.filter((p) => p.userId === userId);
  }
  async listPushUserIds() {
    return [...new Set(this.push.map((p) => p.userId))];
  }
  async claimNotification(userId: string, key: string) {
    const k = `${userId}|${key}`;
    if (this.sent.has(k)) return false;
    this.sent.add(k);
    return true;
  }
}

export class InMemoryPeopleRepository implements PeopleRepository {
  items: Person[] = [];
  async listByUser(userId: string) {
    return this.items.filter((p) => p.userId === userId).sort((a, b) => a.name.localeCompare(b.name));
  }
  async findById(id: string) {
    return this.items.find((p) => p.id === id) ?? null;
  }
  async findByName(userId: string, name: string) {
    return this.items.find((p) => p.userId === userId && p.name.toLowerCase() === name.toLowerCase()) ?? null;
  }
  async create(data: { userId: string; name: string }) {
    const p = { id: randomUUID(), createdAt: new Date(), ...data };
    this.items.push(p);
    return p;
  }
  async rename(id: string, name: string) {
    const p = this.items.find((x) => x.id === id);
    if (!p) throw new Error('Pessoa não encontrada');
    p.name = name;
    return p;
  }
  async delete(id: string) {
    this.items = this.items.filter((p) => p.id !== id);
  }
}

export class InMemoryTostaoAutoRepository implements TostaoAutoRepository {
  insights: TostaoInsight[] = [];
  configs = new Map<string, TostaoAutoConfig>();

  async listByUser(userId: string, opts: { now?: Date; limit?: number } = {}) {
    const now = opts.now ?? new Date();
    return this.insights
      .filter((i) => i.userId === userId && (!i.expiresAt || i.expiresAt > now))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, opts.limit ?? 50);
  }
  async listWhatsappNotifiableUserIds({ after, limit }: { after?: string | null; limit: number }) {
    // Em memória não há tabela de WhatsApp aqui: o aviso confere o número na hora de mandar (jobs/notifications).
    return [...this.configs.entries()]
      .filter(([id, c]) => c.notifyWhatsapp && (!after || id > after))
      .map(([id]) => id)
      .sort()
      .slice(0, limit);
  }

  async findById(id: string) {
    return this.insights.find((i) => i.id === id) ?? null;
  }

  async upsertPending(data: UpsertTostaoInsight) {
    const existing = this.insights.find((i) => i.userId === data.userId && i.dedupeKey === data.dedupeKey);
    if (!existing) {
      const created: TostaoInsight = {
        id: randomUUID(),
        userId: data.userId,
        routine: data.routine,
        kind: data.kind,
        severity: data.severity,
        title: data.title,
        body: data.body,
        payload: data.payload,
        dedupeKey: data.dedupeKey,
        status: 'PENDING',
        expiresAt: data.expiresAt ?? null,
        createdAt: new Date(),
        actedAt: null,
      };
      this.insights.push(created);
      return { insight: created, created: true };
    }
    const reopenUncat = shouldReopenInsight(existing, data);

    if (existing.status === 'PENDING' || reopenUncat) {
      existing.title = data.title;
      existing.body = data.body;
      existing.severity = data.severity;
      existing.payload = data.payload;
      existing.expiresAt = data.expiresAt ?? null;
      existing.status = 'PENDING';
      existing.actedAt = null;
      return { insight: existing, created: reopenUncat };
    }
    return { insight: existing, created: false };
  }

  async setStatus(id: string, status: TostaoInsightStatus, actedAt: Date | null) {
    const item = this.insights.find((i) => i.id === id);
    if (!item) throw new Error('Achado não encontrado');
    item.status = status;
    item.actedAt = actedAt;
    return item;
  }

  async getConfig(userId: string): Promise<TostaoAutoConfig> {
    return (
      this.configs.get(userId) ?? {
        userId,
        carameloExtrato: true,
        tostaoPrevisao: true,
        guardiaoLimites: true,
        olheiroAcertos: true,
        notifyPush: true,
        notifyWhatsapp: false,
        lastCheckedAt: null,
        updatedAt: new Date(0),
      }
    );
  }

  async updateConfig(
    userId: string,
    patch: UpdateTostaoAutoConfigBody & { lastCheckedAt?: Date },
  ): Promise<TostaoAutoConfig> {
    const current = await this.getConfig(userId);
    const next: TostaoAutoConfig = { ...current, ...patch, updatedAt: new Date() };
    this.configs.set(userId, next);
    return next;
  }
}

export class InMemoryOutboxRepository implements OutboxRepository {
  items: OutboxJob[] = [];
  async enqueue(job: NewOutboxJob) {
    const row: OutboxJob = {
      id: randomUUID(),
      type: job.type,
      payload: job.payload,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: job.maxAttempts ?? 8,
      runAt: job.runAt ?? new Date(),
      lockedAt: null,
      lastError: null,
      processedAt: null,
      createdAt: new Date(),
    };
    this.items.push(row);
    return row;
  }
  async claimDue(now: Date, limit: number, lockTimeoutMs = 10 * 60_000) {
    const mine: OutboxJob[] = [];
    for (const j of this.items) {
      if (mine.length >= limit) break;
      const stale = j.lockedAt !== null && now.getTime() - j.lockedAt.getTime() > lockTimeoutMs;
      if (j.status === 'PENDING' && j.runAt <= now && (j.lockedAt === null || stale)) {
        j.lockedAt = now;
        j.attempts += 1;
        mine.push({ ...j });
      }
    }
    return mine;
  }
  async markDone(id: string, now: Date) {
    const j = this.items.find((x) => x.id === id);
    if (j) Object.assign(j, { status: 'DONE', processedAt: now, lockedAt: null, lastError: null });
  }
  async markAttemptFailed(id: string, error: string, nextRunAt: Date | null) {
    const j = this.items.find((x) => x.id === id);
    if (!j) return;
    j.lastError = error.slice(0, 500);
    j.lockedAt = null;
    if (nextRunAt) j.runAt = nextRunAt;
    else j.status = 'FAILED';
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  items: AuditLog[] = [];
  async record(e: NewAuditLog) {
    this.items.push({
      id: randomUUID(),
      userId: e.userId ?? null,
      action: e.action,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      metadata: e.metadata ?? null,
      ipAddress: e.ipAddress ?? null,
      createdAt: new Date(),
    });
  }
}

export class InMemoryUserConsentsRepository implements UserConsentsRepository {
  items: UserConsent[] = [];
  async grant({ userId, type, version, at }: { userId: string; type: UserConsent['type']; version: string; at: Date }) {
    for (const c of this.items) if (c.userId === userId && c.type === type && !c.revokedAt) c.revokedAt = at;
    this.items.push({
      id: randomUUID(),
      userId,
      type,
      version,
      grantedAt: at,
      revokedAt: null,
      ipAddress: null,
      userAgent: null,
    });
  }
  async revoke(userId: string, type: UserConsent['type'], at: Date) {
    for (const c of this.items) if (c.userId === userId && c.type === type && !c.revokedAt) c.revokedAt = at;
  }
  async listByUser(userId: string) {
    return this.items.filter((c) => c.userId === userId);
  }
}

export class InMemoryRecurringRulesRepository implements RecurringRulesRepository {
  items: RecurringRule[] = [];
  async create(data: NewRecurringRule) {
    const now = new Date();
    const r: RecurringRule = { id: randomUUID(), createdAt: now, updatedAt: now, ...data };
    this.items.push(r);
    return { ...r };
  }
  async findById(id: string) {
    const r = this.items.find((x) => x.id === id);
    return r ? { ...r } : null;
  }
  async listByUser(userId: string) {
    return this.items.filter((r) => r.userId === userId).map((r) => ({ ...r }));
  }
  async listActiveByUser(userId: string) {
    return this.items.filter((r) => r.userId === userId && r.active).map((r) => ({ ...r }));
  }
  async listDue(now: Date, limit: number, userId?: string) {
    return this.items
      .filter((r) => r.active && r.autoPost && r.nextRunAt <= now && (!userId || r.userId === userId))
      .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime() || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }
  async save(rule: RecurringRule) {
    const i = this.items.findIndex((r) => r.id === rule.id);
    if (i >= 0) this.items[i] = { ...rule, updatedAt: new Date() };
  }
  async advance(
    id: string,
    expectedNextRunAt: Date,
    next: { nextRunAt: Date; postedInstallments: number; active: boolean },
  ) {
    const r = this.items.find((x) => x.id === id);
    if (!r || !r.active || r.nextRunAt.getTime() !== expectedNextRunAt.getTime()) return false;
    Object.assign(r, next, { updatedAt: new Date() });
    return true;
  }
  async delete(id: string) {
    this.items = this.items.filter((r) => r.id !== id);
  }
}

export class InMemoryAutomationTokensRepository implements AutomationTokensRepository {
  items: AutomationToken[] = [];
  async createLimited(data: Pick<AutomationToken, 'userId' | 'label' | 'tokenHash'>, max: number) {
    if (this.items.filter((t) => t.userId === data.userId && !t.revokedAt).length >= max) return null;
    const t: AutomationToken = { id: randomUUID(), lastUsedAt: null, revokedAt: null, createdAt: new Date(), ...data };
    this.items.push(t);
    return { ...t };
  }
  async listByUser(userId: string) {
    return this.items.filter((t) => t.userId === userId).map((t) => ({ ...t }));
  }
  async findByHash(tokenHash: string) {
    const t = this.items.find((x) => x.tokenHash === tokenHash);
    return t ? { ...t } : null;
  }
  async revoke(userId: string, id: string, at: Date) {
    const t = this.items.find((x) => x.id === id && x.userId === userId);
    if (!t) return false;
    t.revokedAt ??= at;
    return true;
  }
  async touch(id: string, at: Date) {
    const t = this.items.find((x) => x.id === id);
    if (t && (!t.lastUsedAt || t.lastUsedAt.getTime() < at.getTime() - 60_000)) t.lastUsedAt = at;
  }
}

export function makeInMemoryRepositories() {
  const oauthAccounts = new InMemoryOAuthAccountsRepository();
  const transactions = new InMemoryTransactionsRepository();
  const accounts = new InMemoryAccountsRepository(transactions);
  transactions.accounts = accounts;
  const categories = new InMemoryCategoriesRepository();
  transactions.categories = categories;
  const refreshTokens = new InMemoryRefreshTokensRepository();
  const users = new InMemoryUsersRepository({ oauthAccounts, refreshTokens });
  const repos = {
    // Em memória não há rollback: roda em sequência no mesmo conjunto (os testes de atomicidade real são no Postgres).
    tx: <T>(fn: (r: Repositories) => Promise<T>): Promise<T> => fn(repos as unknown as Repositories),
    outbox: new InMemoryOutboxRepository(),
    audit: new InMemoryAuditLogRepository(),
    consents: new InMemoryUserConsentsRepository(),
    users,
    oauthAccounts,
    connections: new InMemoryBankConnectionsRepository({ accounts, transactions }),
    accounts,
    categories,
    rules: new InMemoryCategoryRulesRepository(),
    transactions,
    budgets: new InMemoryBudgetsRepository(),
    lessons: new InMemoryLessonProgressRepository(),
    ignoredSubscriptions: new InMemoryIgnoredSubscriptionsRepository(),
    invites: new InMemoryInvitesRepository(),
    passwordResets: new InMemoryPasswordResetsRepository(users, refreshTokens),
    refreshTokens,
    emailVerifications: new InMemoryEmailVerificationTokensRepository(users),
    chat: new InMemoryChatMessagesRepository(),
    plans: new InMemoryFinancialPlansRepository(),
    whatsapp: new InMemoryWhatsappLinksRepository(),
    games: new InMemoryGamesRepository(),
    engagement: new InMemoryEngagementRepository(),
    people: new InMemoryPeopleRepository(),
    tostaoAuto: new InMemoryTostaoAutoRepository(),
    reconciledNotes: new InMemoryReconciledNotesRepository(),
    recurring: new InMemoryRecurringRulesRepository(),
    automationTokens: new InMemoryAutomationTokensRepository(),
  } satisfies Repositories;
  return repos;
}
