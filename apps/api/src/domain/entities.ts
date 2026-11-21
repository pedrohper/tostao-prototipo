// Entidades do domínio: o formato "puro" dos dados, sem Prisma, sem HTTP.
// Os use cases só conhecem isso aqui. Trocar o banco não muda nada nesse arquivo.

export type OAuthProvider = 'google' | 'apple';

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  /** Quando provamos que a pessoa controla o e-mail. null = não verificado (todo cadastro por senha, por enquanto). */
  emailVerifiedAt: Date | null;
  /** Aceite dos Termos/Privacidade no cadastro (null em contas antigas e sociais). */
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  /** Consentimento LGPD pra usar IA. null = não aceitou (chat e categorização automática bloqueados). */
  aiConsentAt: Date | null;
  /** Fuso da pessoa (IANA). Dia civil e fechamento de mês usam isto. */
  timezone: string;
  createdAt: Date;
};

export type OAuthAccount = {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  createdAt: Date;
};

export type BankConnection = {
  id: string;
  userId: string;
  itemId: string;
  institution: string | null;
  /** RECONNECT_REQUIRED: 3 falhas seguidas do sync; a pessoa precisa reconectar o banco. */
  status: 'ACTIVE' | 'ERROR' | 'RECONNECT_REQUIRED';
  lastSyncedAt: Date | null;
  /** Falhas seguidas do sync (zera no primeiro sucesso). */
  errorCount: number;
  lastErrorAt: Date | null;
  createdAt: Date;
};

export type Account = {
  id: string;
  userId: string;
  connectionId: string;
  externalId: string;
  name: string;
  type: 'BANK' | 'CREDIT';
  balanceInCents: number;
  /** Identidade do cartão fora do provedor (bandeira + final). Pega o mesmo cartão vindo de duas conexões. */
  fingerprint: string | null;
  /** Cartão: limite total e vencimento da fatura atual, quando o banco informa. */
  creditLimitInCents: number | null;
  dueDate: Date | null;
  /** Ocultada pela pessoa: some da tela e do saldo, mas continua sincronizando. */
  hidden: boolean;
  currency?: string;
};

/** kind "neutra" = não conta como gasto nem renda (ex.: repasse com a família). userId null = categoria do sistema. */
export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: 'saida' | 'entrada' | 'neutra';
  userId?: string | null;
};

/** Categoria do sistema pra "isso não conta": vira transferência interna. */
export const NEUTRAL_CATEGORY_ID = 'nao-conta';

export type CategoryRule = {
  id: string;
  userId: string | null; // null = regra padrão do sistema
  pattern: string;
  categoryId: string;
};

export type Transaction = {
  id: string;
  userId: string;
  accountId: string | null; // null = anotado na mão
  externalId: string | null;
  description: string;
  amountInCents: number; // negativo = saída
  occurredAt: Date;
  categoryId: string | null;
  isInternalTransfer: boolean;
  /** true = a pessoa marcou como transferência; false = a pessoa desmarcou; null/ausente = automático. */
  internalTransferManual?: boolean | null;
  /** "Todo mês" ou "parcelado" anotado à mão: as ocorrências futuras têm o mesmo seriesId. */
  seriesId?: string | null;
  /** Acerto com alguém: sai do gasto e da renda e entra no saldo dessa pessoa. */
  personId?: string | null;
  /** Observação livre da pessoa sobre o lançamento. */
  note?: string | null;
  currency?: string;
  createdAt: Date;
};

/** Anotação à mão apagada sozinha porque o banco confirmou a cobrança. Fica de histórico. */
export type ReconciledNote = {
  id: string;
  userId: string;
  description: string;
  amountInCents: number;
  occurredAt: Date;
  categoryId: string | null;
  note: string | null;
  bankTransactionId: string | null;
  bankDescription: string;
  reconciledAt: Date;
};

export type Person = { id: string; userId: string; name: string; createdAt: Date };

export type CategoryBudget = { id: string; userId: string; categoryId: string; limitInCents: number };

export type LessonProgress = { userId: string; lessonId: string; completedAt: Date };

export type Invite = {
  code: string;
  /** null: quem criou apagou a conta (o convite e o seu uso continuam valendo como histórico). */
  createdById: string | null;
  usedById: string | null;
  createdAt: Date;
  usedAt: Date | null;
};
export type PasswordReset = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };

/** Sessão revogável. `tokenHash` é o SHA-256 do token opaco; o token em si nunca é guardado. */
export type RefreshToken = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
};
export type EmailVerificationToken = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type ChatMessage = {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  channel: 'app' | 'whatsapp';
  createdAt: Date;
};

// Jogos: Tribunal (enquete da semana) e Batalha (desafio conferido no extrato)
export type TribunalVote = { userId: string; caseId: string; weekKey: string; choice: number; votedAt: Date };
export type BattleKind = 'tigrinho' | 'urubu';
export type BattleStatus = 'ativa' | 'vencida' | 'perdida';
export type Battle = {
  userId: string;
  kind: BattleKind;
  status: BattleStatus;
  startedAt: Date;
  endedAt: Date | null;
  steps: string[];
};

export type TostaoRoutine = 'caramelo_extrato' | 'tostao_previsao' | 'guardiao_limites' | 'olheiro_acertos';
export type TostaoInsightSeverity = 'info' | 'warning' | 'urgent';
export type TostaoInsightStatus = 'PENDING' | 'APPLIED' | 'DISMISSED';

export type TostaoInsight = {
  id: string;
  userId: string;
  routine: TostaoRoutine;
  kind: string;
  severity: TostaoInsightSeverity;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  status: TostaoInsightStatus;
  expiresAt: Date | null;
  createdAt: Date;
  actedAt: Date | null;
};

export type TostaoAutoConfig = {
  userId: string;
  carameloExtrato: boolean;
  tostaoPrevisao: boolean;
  guardiaoLimites: boolean;
  olheiroAcertos: boolean;
  notifyPush: boolean;
  notifyWhatsapp: boolean;
  lastCheckedAt: Date | null;
  updatedAt: Date;
};

/** Histórico de consentimento (LGPD). users.terms_accepted_at / ai_consent_at seguem sendo o estado atual. */
export type UserConsent = {
  id: string;
  userId: string;
  type: 'terms' | 'privacy' | 'ai';
  version: string;
  grantedAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
};

/** Evento de segurança. userId vira null se a conta for apagada. */
export type AuditAction = 'password_reset' | 'account_deleted' | 'consent_changed' | 'refresh_reuse_detected';
export type AuditLog = {
  id: string;
  userId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
};

/** Tarefa a refazer depois (ex.: desligar o Item do Pluggy quando o provedor estava fora do ar). */
export type OutboxJobType = 'pluggy.deleteItem';
export type OutboxJob = {
  id: string;
  type: OutboxJobType;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DONE' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedAt: Date | null;
  lastError: string | null;
  processedAt: Date | null;
  createdAt: Date;
};

export type FriendRequest = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: Date;
  respondedAt: Date | null;
};
