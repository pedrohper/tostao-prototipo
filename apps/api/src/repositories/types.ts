// Contratos dos repositórios. O use case pede "alguém que saiba salvar usuário",
// sem saber se é Postgres ou um array na memória (nos testes).
import type { Account, BankConnection, Category, CategoryRule, Transaction, User, CategoryBudget, LessonProgress, Invite, PasswordReset, ChatMessage, TribunalVote, Battle, BattleKind, Person } from '../domain/entities.js';
import type { FinancialPlan } from '@tostao/contracts';

export type NewUser = Pick<User, 'name' | 'email' | 'passwordHash'>;
export interface UsersRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: NewUser): Promise<User>;
  count(): Promise<number>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  /** Apaga a pessoa e, em cascata, tudo que é dela (LGPD: direito de eliminação). */
  delete(id: string): Promise<void>;
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

export type AccountData = Pick<Account, 'userId' | 'connectionId' | 'externalId' | 'name' | 'type' | 'balanceInCents' | 'fingerprint'> &
  Partial<Pick<Account, 'creditLimitInCents' | 'dueDate'>>;
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

export interface GamesRepository {
  /** Um voto por pessoa por caso; votar de novo troca o voto. */
  vote(userId: string, caseId: string, choice: number): Promise<void>;
  findVote(userId: string, caseId: string): Promise<TribunalVote | null>;
  countVotes(caseId: string): Promise<number[]>;
  countUserVotes(userId: string): Promise<number>;
  listBattles(userId: string): Promise<Battle[]>;
  saveBattle(battle: Battle): Promise<void>;
  findBattle(userId: string, kind: BattleKind): Promise<Battle | null>;
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
  delete(id: string): Promise<void>;
  /** Apaga as ocorrências da série a partir de uma data (inclusive). Devolve quantas. */
  deleteSeriesFrom(userId: string, seriesId: string, from: Date): Promise<number>;
  findByPerson(userId: string, personId: string): Promise<Transaction[]>;
}

export interface PeopleRepository {
  listByUser(userId: string): Promise<Person[]>;
  findById(id: string): Promise<Person | null>;
  findByName(userId: string, name: string): Promise<Person | null>;
  create(data: { userId: string; name: string }): Promise<Person>;
  delete(id: string): Promise<void>;
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

export interface ChatMessagesRepository {
  /** As mais recentes, em ordem de conversa (antiga → nova). */
  listRecent(userId: string, limit: number): Promise<ChatMessage[]>;
  create(data: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage>;
  countUserSince(userId: string, since: Date): Promise<number>;
}

export interface FinancialPlansRepository {
  get(userId: string): Promise<FinancialPlan | null>;
  save(userId: string, plan: FinancialPlan): Promise<void>;
}

export type WhatsappLink = { userId: string; phone: string | null; code: string | null; codeExpiresAt: Date | null; linkedAt: Date | null };
export interface WhatsappLinksRepository {
  get(userId: string): Promise<WhatsappLink | null>;
  findByPhone(phone: string): Promise<WhatsappLink | null>;
  findByCode(code: string): Promise<WhatsappLink | null>;
  setCode(userId: string, code: string, expiresAt: Date): Promise<void>;
  /** Liga o número à conta (tira de outra conta, se estava lá) e apaga o código. */
  link(userId: string, phone: string, at: Date): Promise<void>;
  unlink(userId: string): Promise<void>;
}

export type PushSub = { endpoint: string; userId: string; p256dh: string; auth: string };

/** Missões, amigos e avisos: o que faz a pessoa voltar. */
export interface EngagementRepository {
  /** Idempotente: a mesma missão no mesmo dia conta uma vez. */
  markActivity(userId: string, day: string, kind: string): Promise<void>;
  /** Linhas a partir de sinceDay (inclusive), "YYYY-MM-DD". */
  listActivity(userId: string, sinceDay: string): Promise<{ day: string; kind: string }[]>;
  countActivity(userId: string): Promise<number>;
  getFriendCode(userId: string): Promise<string | null>;
  setFriendCode(userId: string, code: string): Promise<void>;
  findUserByFriendCode(code: string): Promise<string | null>;
  /** Guarda nos dois sentidos. */
  addFriend(a: string, b: string): Promise<void>;
  removeFriend(a: string, b: string): Promise<void>;
  listFriendIds(userId: string): Promise<string[]>;
  savePush(sub: PushSub): Promise<void>;
  deletePush(endpoint: string): Promise<void>;
  listPush(userId: string): Promise<PushSub[]>;
  listPushUserIds(): Promise<string[]>;
  /** true se marcou agora; false se já tinha mandado esse aviso. */
  claimNotification(userId: string, key: string): Promise<boolean>;
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
  chat: ChatMessagesRepository;
  plans: FinancialPlansRepository;
  whatsapp: WhatsappLinksRepository;
  games: GamesRepository;
  engagement: EngagementRepository;
  people: PeopleRepository;
};
