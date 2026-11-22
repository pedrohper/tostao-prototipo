// Contratos dos repositórios. O use case pede "alguém que saiba salvar usuário",
// sem saber se é Postgres ou um array na memória (nos testes).
import type {
  Account,
  BankConnection,
  Category,
  CategoryRule,
  Transaction,
  ReconciledNote,
  User,
  CategoryBudget,
  LessonProgress,
  Invite,
  PasswordReset,
  UserConsent,
  AuditAction,
  OutboxJob,
  OutboxJobType,
  RefreshToken,
  EmailVerificationToken,
  ChatMessage,
  TribunalVote,
  FriendRequest,
  Battle,
  BattleKind,
  Person,
  TostaoInsight,
  TostaoInsightSeverity,
  TostaoInsightStatus,
  TostaoRoutine,
  TostaoAutoConfig,
  OAuthAccount,
  OAuthProvider,
  RecurringRule,
  AutomationToken,
} from '../domain/entities.js';
import type { FinancialPlan, UpdateTostaoAutoConfigBody } from '@tostao/contracts';

export type NewUser = Pick<User, 'name' | 'email' | 'passwordHash'> &
  Partial<Pick<User, 'emailVerifiedAt' | 'termsAcceptedAt' | 'termsVersion'>>;
export interface UsersRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  listAllIds(): Promise<string[]>;
  /** Várias pessoas numa query só (amigos, convites). Quem não existe fica de fora. */
  findManyByIds(ids: string[]): Promise<User[]>;
  create(data: NewUser): Promise<User>;
  count(): Promise<number>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  /** Marca o e-mail como verificado (não sobrescreve se já estava). */
  markEmailVerified(id: string, at: Date): Promise<void>;
  /** Registra (at) ou revoga (null) o consentimento pra IA. */
  setAiConsent(id: string, at: Date | null): Promise<void>;
  /** Apaga a pessoa e, em cascata, tudo que é dela (LGPD: direito de eliminação). */
  delete(id: string): Promise<void>;
}

export type NewOAuthAccount = Pick<OAuthAccount, 'userId' | 'provider' | 'providerAccountId' | 'email'>;
export interface OAuthAccountsRepository {
  findByProviderAccount(provider: OAuthProvider, providerAccountId: string): Promise<OAuthAccount | null>;
  listByUser(userId: string): Promise<OAuthAccount[]>;
  create(data: NewOAuthAccount): Promise<OAuthAccount>;
}

export interface BankConnectionsRepository {
  findById(id: string): Promise<BankConnection | null>;
  findByUserAndItem(userId: string, itemId: string): Promise<BankConnection | null>;
  /** Busca em TODOS os usuários: um Item do Open Finance só pode pertencer a uma pessoa. */
  findByItemId(itemId: string): Promise<BankConnection | null>;
  listByUser(userId: string): Promise<BankConnection[]>;
  listActive(): Promise<BankConnection[]>;
  /** Conexões em ERROR cuja última falha foi em `before` ou antes (hora de tentar de novo). RECONNECT_REQUIRED nunca volta sozinha. */
  listRetryable(before: Date): Promise<BankConnection[]>;
  /** ConflictError se o Item (Open Finance) já estiver ligado a alguém. */
  create(data: Pick<BankConnection, 'userId' | 'itemId' | 'institution'>): Promise<BankConnection>;
  save(connection: BankConnection): Promise<void>;
  /** Apaga a conexão e, em cascata, as contas e transações importadas dela. */
  delete(id: string): Promise<void>;
}

export type AccountData = Pick<
  Account,
  'userId' | 'connectionId' | 'externalId' | 'name' | 'type' | 'balanceInCents' | 'fingerprint'
> &
  Partial<Pick<Account, 'creditLimitInCents' | 'dueDate'>>;
export interface AccountsRepository {
  upsertByExternalId(data: AccountData): Promise<Account>;
  listByUser(userId: string): Promise<Account[]>;
  findByFingerprint(userId: string, fingerprint: string): Promise<Account[]>;
  /** Apaga a conta e, em cascata, as transações dela. */
  delete(id: string): Promise<void>;
  setHidden(id: string, hidden: boolean): Promise<void>;
  /** Soma `deltaInCents` ao saldo de forma atômica (balance = balance + delta): dois lançamentos ao mesmo tempo não se perdem. */
  adjustBalance(id: string, deltaInCents: number): Promise<void>;
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
  /** Só regras DESTA pessoa (nunca mexe nas do sistema nem nas de outro usuário). */
  deleteByCategory(userId: string, categoryId: string): Promise<void>;
}

export interface BudgetsRepository {
  listByUser(userId: string): Promise<CategoryBudget[]>;
  upsert(data: Omit<CategoryBudget, 'id'>): Promise<CategoryBudget>;
  delete(userId: string, categoryId: string): Promise<void>;
  deleteByCategory(userId: string, categoryId: string): Promise<void>;
}

export interface LessonProgressRepository {
  listByUser(userId: string): Promise<LessonProgress[]>;
  /** As lições de várias pessoas numa query só (ranking de amigos). */
  listByUsers(userIds: string[]): Promise<LessonProgress[]>;
  /** Idempotente: marcar de novo não duplica. */
  markDone(userId: string, lessonId: string): Promise<void>;
}

export interface GamesRepository {
  /** Um voto por pessoa por caso; votar de novo troca o voto. */
  /** Um voto por pessoa, por caso, por semana. false se a pessoa já votou nesse caso nessa semana (nunca troca o voto). */
  vote(userId: string, caseId: string, weekKey: string, choice: number): Promise<boolean>;
  findVote(userId: string, caseId: string, weekKey: string): Promise<TribunalVote | null>;
  countVotes(caseId: string, weekKey: string): Promise<number[]>;
  countUserVotes(userId: string): Promise<number>;
  listBattles(userId: string): Promise<Battle[]>;
  saveBattle(battle: Battle): Promise<void>;
  findBattle(userId: string, kind: BattleKind): Promise<Battle | null>;
  /** Lock otimista (ver FinancialPlansRepository.mutate). */
  mutateBattle(userId: string, kind: BattleKind, fn: (current: Battle | null) => Battle): Promise<Battle>;
}

export interface IgnoredSubscriptionsRepository {
  listKeys(userId: string): Promise<string[]>;
  set(userId: string, key: string, ignored: boolean): Promise<void>;
}

export type TransactionSearchFilter = {
  /** Intervalo [from, to); `from` null = desde sempre. */
  from: Date | null;
  to: Date;
  /** Palavras (minúsculas): cada uma tem que aparecer na descrição, no nome da categoria OU no nome da conta. */
  words: string[];
  kind: 'todas' | 'saida' | 'entrada';
  /** 'sem' = só os sem categoria. */
  categoryId?: string;
  excludeTransfers?: boolean;
  excludeYields?: boolean;
  limit: number;
  cursor?: { occurredAt: Date; id: string };
};

export type TransactionSearchResult = {
  /** No máximo `limit`. */
  transactions: Transaction[];
  /** Cursor da próxima página, ou null se acabou. */
  nextCursor: { occurredAt: Date; id: string } | null;
  /** Totais de TODAS as páginas do mesmo filtro (a soma ignora transferência interna). */
  count: number;
  outInCents: number;
  inInCents: number;
};

/** Resumo de acertos de uma pessoa: o que saiu menos o que entrou (positivo = ela te deve). */
export type PersonBalance = { personId: string; balanceInCents: number; count: number; lastAt: Date | null };

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;
export interface TransactionsRepository {
  findById(id: string): Promise<Transaction | null>;
  findByExternalId(userId: string, externalId: string): Promise<Transaction | null>;
  /** Os que já existem, de uma vez (sync e importação: no lugar de 1 consulta por lançamento). */
  findByExternalIds(userId: string, externalIds: string[]): Promise<Transaction[]>;
  /** Intervalo [from, to) */
  findManyInRange(userId: string, from: Date, to: Date): Promise<Transaction[]>;
  findUncategorized(userId: string): Promise<Transaction[]>;
  create(data: NewTransaction): Promise<Transaction>;
  save(transaction: Transaction): Promise<void>;
  /**
   * Insere vários de uma vez (tudo ou nada). Devolve quantos.
   * Com `skipDuplicates`, o que já existe (mesmo userId + externalId) é pulado em vez de falhar, e o retorno conta só os
   * novos; nesse modo grava em lotes (sem o "tudo ou nada": rodar de novo completa o que faltou).
   */
  createMany(data: (NewTransaction & { id?: string })[], opts?: { skipDuplicates?: boolean }): Promise<number>;
  /** Liga/desliga "transferência interna" de vários lançamentos DESSA pessoa numa query só (não mexe na decisão manual). */
  setInternalTransfer(userId: string, ids: string[], isInternalTransfer: boolean): Promise<number>;
  /** Põe a categoria só nos que continuam sem categoria (a pessoa pode ter categorizado no meio). Devolve quantos. */
  categorizeUncategorized(userId: string, ids: string[], categoryId: string): Promise<number>;
  /** Saldo, quantidade e último acerto de cada pessoa do caderninho, agregados no banco. */
  summarizeByPerson(userId: string): Promise<PersonBalance[]>;
  /**
   * Busca paginada: filtros, ordem (occurredAt desc, id desc), página e totais no banco. Nada de carregar o histórico
   * inteiro pra filtrar em JavaScript.
   */
  search(userId: string, filter: TransactionSearchFilter): Promise<TransactionSearchResult>;
  /** Tira a categoria (volta pra pendente) das transações DESSA pessoa nessa categoria. */
  clearCategory(userId: string, categoryId: string): Promise<void>;
  /** Apaga só os lançamentos que vieram do banco (external_id não nulo) das contas dessa conexão. Devolve quantos. */
  deleteBankByConnection(userId: string, connectionId: string): Promise<number>;
  /** Idem, pra uma conta só (ex.: cópia duplicada de cartão). */
  deleteBankByAccount(userId: string, accountId: string): Promise<number>;
  delete(id: string): Promise<void>;
  /** Apaga as ocorrências da série a partir de uma data (inclusive). Devolve quantas. */
  deleteSeriesFrom(userId: string, seriesId: string, from: Date): Promise<number>;
  findByPerson(userId: string, personId: string): Promise<Transaction[]>;
  /** Tudo que foi anotado à mão (sem externalId), mais recente primeiro. */
  findManualByUser(userId: string): Promise<Transaction[]>;
  /**
   * Lançamentos de conta MANUAL (de qualquer pessoa) cuja data já chegou (`occurredAt <= now`) e que ainda não pesaram
   * no saldo (`balanceAppliedAt` nulo). É o que o job de materialização aplica. Mais antigos primeiro.
   */
  findBalancePending(now: Date, limit: number): Promise<Transaction[]>;
  /**
   * Trava: marca o lançamento como "já pesou no saldo" SE ainda não estava (UPDATE condicional). true = esta chamada
   * foi quem marcou (só ela pode ajustar o saldo); false = outra já tinha marcado. Duas execuções nunca aplicam 2x.
   */
  claimBalanceApplication(id: string, at: Date): Promise<boolean>;
}

export type NewRecurringRule = Omit<RecurringRule, 'id' | 'createdAt' | 'updatedAt'>;
export interface RecurringRulesRepository {
  create(data: NewRecurringRule): Promise<RecurringRule>;
  findById(id: string): Promise<RecurringRule | null>;
  listByUser(userId: string): Promise<RecurringRule[]>;
  /** Regras ativas de uma pessoa (previsão). */
  listActiveByUser(userId: string): Promise<RecurringRule[]>;
  /** Ativas, com lançamento automático ligado e vencimento até `now`, de QUALQUER pessoa (o job). */
  listDue(now: Date, limit: number, userId?: string): Promise<RecurringRule[]>;
  save(rule: RecurringRule): Promise<void>;
  /**
   * Passo do job: avança a regra SE ela ainda está no vencimento `expectedNextRunAt` (UPDATE condicional). true = esta
   * chamada avançou (só ela pode lançar essa ocorrência); false = outra execução já avançou. Duas execuções no mesmo
   * dia nunca contam a mesma parcela duas vezes.
   */
  advance(
    id: string,
    expectedNextRunAt: Date,
    next: { nextRunAt: Date; postedInstallments: number; active: boolean },
  ): Promise<boolean>;
  delete(id: string): Promise<void>;
}

export interface AutomationTokensRepository {
  /** Cria só se a pessoa tiver menos de `max` tokens ativos (decisão atômica: duas criações juntas não passam do teto). null = no limite. */
  createLimited(
    data: Pick<AutomationToken, 'userId' | 'label' | 'tokenHash'>,
    max: number,
  ): Promise<AutomationToken | null>;
  listByUser(userId: string): Promise<AutomationToken[]>;
  findByHash(tokenHash: string): Promise<AutomationToken | null>;
  /** Revoga um token DESSA pessoa. false = não existe (ou é de outra pessoa). */
  revoke(userId: string, id: string, at: Date): Promise<boolean>;
  /** Marca o uso (no máximo 1 escrita por minuto por token). */
  touch(id: string, at: Date): Promise<void>;
}

export type NewReconciledNote = Omit<ReconciledNote, 'id' | 'reconciledAt'>;
export interface ReconciledNotesRepository {
  create(data: NewReconciledNote, at?: Date): Promise<ReconciledNote>;
  /** Mais recentes primeiro. */
  listByUser(userId: string, limit?: number): Promise<ReconciledNote[]>;
}

export interface PeopleRepository {
  listByUser(userId: string): Promise<Person[]>;
  findById(id: string): Promise<Person | null>;
  findByName(userId: string, name: string): Promise<Person | null>;
  create(data: { userId: string; name: string }): Promise<Person>;
  rename(id: string, name: string): Promise<Person>;
  delete(id: string): Promise<void>;
}

export interface InvitesRepository {
  create(data: { code: string; createdById: string }): Promise<Invite>;
  findByCode(code: string): Promise<Invite | null>;
  /** Usa o convite de forma atômica: true só pra quem conseguiu (convite pendente). Reuso e corrida → false. */
  markUsed(code: string, userId: string): Promise<boolean>;
  listByCreator(userId: string): Promise<Invite[]>;
}

export interface PasswordResetsRepository {
  findByTokenHash(tokenHash: string): Promise<PasswordReset | null>;
  /** Invalida os links pendentes da pessoa e cria o novo, tudo ou nada (só o último link vale). */
  replacePending(data: { userId: string; tokenHash: string; expiresAt: Date }, now: Date): Promise<PasswordReset>;
  /**
   * Resgata o link e troca a senha de forma atômica: o link só é consumido se estiver pendente e dentro da validade
   * (dois resgates simultâneos do mesmo link: só um passa). No mesmo bloco: marca o e-mail como verificado
   * (o link chegou na caixa de entrada) e revoga TODAS as sessões (refresh tokens) da pessoa.
   * Devolve null se o link não valia mais.
   */
  redeem(data: { tokenHash: string; passwordHash: string; now: Date }): Promise<{ userId: string } | null>;
}

export type NewRefreshToken = Pick<
  RefreshToken,
  'userId' | 'tokenHash' | 'familyId' | 'expiresAt' | 'userAgent' | 'ipAddress'
>;
export type RotateRefreshResult =
  | { status: 'rotated'; userId: string; familyId: string }
  | { status: 'reused'; userId: string; familyId: string }
  | { status: 'invalid' };
export interface RefreshTokensRepository {
  create(data: NewRefreshToken): Promise<RefreshToken>;
  /**
   * Troca atômica: só quem consegue marcar o token como revogado (pendente + dentro da validade) recebe o novo.
   * Token JÁ revogado reapresentado = reuso: a família inteira é revogada no mesmo bloco.
   */
  rotate(data: {
    tokenHash: string;
    now: Date;
    next: Omit<NewRefreshToken, 'userId' | 'familyId'>;
  }): Promise<RotateRefreshResult>;
  /** Revoga a família do token (logout deste aparelho). Idempotente; token desconhecido não faz nada. */
  revokeFamilyOf(tokenHash: string, now: Date): Promise<void>;
  /** Revoga todas as sessões da pessoa (logout-all, troca de senha, exclusão de conta). */
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

export interface EmailVerificationTokensRepository {
  /** Invalida os links pendentes e cria o novo, tudo ou nada. */
  replacePending(
    data: { userId: string; tokenHash: string; expiresAt: Date },
    now: Date,
  ): Promise<EmailVerificationToken>;
  /** Consome o link (pendente e dentro da validade) e marca o e-mail como verificado, atomicamente. null = link inválido. */
  consume(data: { tokenHash: string; now: Date }): Promise<{ userId: string } | null>;
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
  /**
   * Ler → alterar → gravar sem perder escrita concorrente (lock otimista por `version`; até 3 tentativas,
   * depois ConflictError 409). `fn` pode rodar mais de uma vez: não faça efeito colateral nela.
   */
  mutate(userId: string, fn: (current: FinancialPlan | null) => FinancialPlan): Promise<FinancialPlan>;
}

export type WhatsappLink = {
  userId: string;
  phone: string | null;
  /** SHA-256 do código de vínculo. O código em si nunca é guardado. */
  codeHash: string | null;
  codeExpiresAt: Date | null;
  linkedAt: Date | null;
};
export interface WhatsappLinksRepository {
  get(userId: string): Promise<WhatsappLink | null>;
  findByPhone(phone: string): Promise<WhatsappLink | null>;
  findByCodeHash(codeHash: string): Promise<WhatsappLink | null>;
  /** Guarda o hash do código e invalida o anterior (um código ativo por pessoa). */
  setCode(userId: string, codeHash: string, expiresAt: Date): Promise<void>;
  /** Liga o número à conta e apaga o código. Nunca tira o número de outra conta: quem chama confere antes. */
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
  /** A atividade de várias pessoas numa query só (ranking de amigos). */
  listActivityForUsers(userIds: string[], sinceDay: string): Promise<{ userId: string; day: string; kind: string }[]>;
  countActivity(userId: string): Promise<number>;
  getFriendCode(userId: string): Promise<string | null>;
  setFriendCode(userId: string, code: string): Promise<void>;
  findUserByFriendCode(code: string): Promise<string | null>;
  /** Guarda nos dois sentidos. */
  addFriend(a: string, b: string): Promise<void>;
  /** Pedido de amizade: único por par (quem pediu, quem recebe). Devolve o pedido existente se já havia. */
  createFriendRequest(requesterId: string, addresseeId: string): Promise<{ request: FriendRequest; created: boolean }>;
  findFriendRequest(a: string, b: string): Promise<FriendRequest | null>;
  listIncomingFriendRequests(userId: string): Promise<FriendRequest[]>;
  listOutgoingFriendRequests(userId: string): Promise<FriendRequest[]>;
  /** Responde um pedido PENDING dirigido a `userId`, de forma atômica. Devolve o pedido, ou null se não existe/já respondido/não é pra essa pessoa. */
  respondFriendRequest(id: string, userId: string, accept: boolean, at: Date): Promise<FriendRequest | null>;
  removeFriend(a: string, b: string): Promise<void>;
  listFriendIds(userId: string): Promise<string[]>;
  /** ForbiddenError se o endpoint já pertence a outro usuário (nunca sobrescreve o dono). */
  savePush(sub: PushSub): Promise<void>;
  deletePush(endpoint: string): Promise<void>;
  listPush(userId: string): Promise<PushSub[]>;
  listPushUserIds(): Promise<string[]>;
  /** true se marcou agora; false se já tinha mandado esse aviso. */
  claimNotification(userId: string, key: string): Promise<boolean>;
}

export type UpsertTostaoInsight = {
  userId: string;
  routine: TostaoRoutine;
  kind: string;
  severity: TostaoInsightSeverity;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  expiresAt?: Date | null;
};

export interface TostaoAutoRepository {
  /** Achados vivos (sem validade ou ainda dentro dela), mais recentes primeiro, no máximo `limit` (padrão 50). */
  listByUser(userId: string, opts?: { now?: Date; limit?: number }): Promise<TostaoInsight[]>;
  /**
   * Quem quer aviso por WhatsApp (config `notifyWhatsapp` ligada e número vinculado), em ordem de id, em páginas:
   * `after` é o último id da página anterior. Evita varrer todos os usuários a cada 15 minutos.
   */
  listWhatsappNotifiableUserIds(opts: { after?: string | null; limit: number }): Promise<string[]>;
  findById(id: string): Promise<TostaoInsight | null>;
  /** Cria se ainda não existir; se já existe PENDING (ou reabriu), atualiza título/corpo/payload e devolve { created }. */
  upsertPending(data: UpsertTostaoInsight): Promise<{ insight: TostaoInsight; created: boolean }>;
  setStatus(id: string, status: TostaoInsightStatus, actedAt: Date | null): Promise<TostaoInsight>;
  getConfig(userId: string): Promise<TostaoAutoConfig>;
  updateConfig(userId: string, patch: UpdateTostaoAutoConfigBody & { lastCheckedAt?: Date }): Promise<TostaoAutoConfig>;
}

export type NewOutboxJob = {
  type: OutboxJobType;
  payload: Record<string, unknown>;
  runAt?: Date;
  maxAttempts?: number;
};
export interface OutboxRepository {
  enqueue(job: NewOutboxJob): Promise<OutboxJob>;
  /** Pega (e trava) até `limit` jobs pendentes com runAt <= now. Dois workers nunca recebem o mesmo job. */
  claimDue(now: Date, limit: number, lockTimeoutMs?: number): Promise<OutboxJob[]>;
  markDone(id: string, now: Date): Promise<void>;
  /** Registra a falha. `nextRunAt` null = estourou as tentativas (FAILED). */
  markAttemptFailed(id: string, error: string, nextRunAt: Date | null): Promise<void>;
}

export type NewAuditLog = {
  userId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};
export interface AuditLogRepository {
  record(entry: NewAuditLog): Promise<void>;
}

export interface UserConsentsRepository {
  /** Registra um aceite (e fecha o anterior do mesmo tipo, se aberto). */
  grant(data: { userId: string; type: UserConsent['type']; version: string; at: Date }): Promise<void>;
  /** Revoga o aceite aberto desse tipo. */
  revoke(userId: string, type: UserConsent['type'], at: Date): Promise<void>;
  listByUser(userId: string): Promise<UserConsent[]>;
}

export type Repositories = {
  /** Roda `fn` numa transação: tudo grava junto ou nada grava. Dentro de `fn`, use SÓ o `repos` recebido. */
  tx<T>(fn: (repos: Repositories) => Promise<T>): Promise<T>;
  outbox: OutboxRepository;
  audit: AuditLogRepository;
  consents: UserConsentsRepository;
  users: UsersRepository;
  oauthAccounts: OAuthAccountsRepository;
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
  refreshTokens: RefreshTokensRepository;
  emailVerifications: EmailVerificationTokensRepository;
  chat: ChatMessagesRepository;
  plans: FinancialPlansRepository;
  whatsapp: WhatsappLinksRepository;
  games: GamesRepository;
  engagement: EngagementRepository;
  people: PeopleRepository;
  tostaoAuto: TostaoAutoRepository;
  reconciledNotes: ReconciledNotesRepository;
  recurring: RecurringRulesRepository;
  automationTokens: AutomationTokensRepository;
};
