// Entidades do domínio: o formato "puro" dos dados, sem Prisma, sem HTTP.
// Os use cases só conhecem isso aqui. Trocar o banco não muda nada nesse arquivo.

export type OAuthProvider = 'google' | 'apple';

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
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
  status: 'ACTIVE' | 'ERROR';
  lastSyncedAt: Date | null;
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
  /** "Todo mês" ou "parcelado" anotado à mão: as ocorrências futuras têm o mesmo seriesId. */
  seriesId?: string | null;
  /** Acerto com alguém: sai do gasto e da renda e entra no saldo dessa pessoa. */
  personId?: string | null;
  /** Observação livre da pessoa sobre o lançamento. */
  note?: string | null;
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
  createdById: string;
  usedById: string | null;
  createdAt: Date;
  usedAt: Date | null;
};
export type PasswordReset = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };

export type ChatMessage = {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  channel: 'app' | 'whatsapp';
  createdAt: Date;
};

// Jogos: Tribunal (enquete da semana) e Batalha (desafio conferido no extrato)
export type TribunalVote = { userId: string; caseId: string; choice: number; votedAt: Date };
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
