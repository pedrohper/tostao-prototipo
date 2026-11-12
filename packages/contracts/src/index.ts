// Contratos compartilhados entre a API e a web.
// Tudo que atravessa a rede passa por aqui: o schema Zod valida na API
// e o tipo inferido (z.infer) tipa a web. Um lugar só pra mudar.
import { z } from 'zod';

// ---------- Auth ----------
export const registerBody = z.object({
  name: z.string().trim().min(2, 'Nome muito curto'),
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
  inviteCode: z.string().trim().max(40).optional(),
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Digite a senha'),
});
export type LoginBody = z.infer<typeof loginBody>;

export type AuthResponse = { token: string };

export const resetPasswordBody = z.object({
  token: z.string().min(20),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
});

export type InviteDTO = { code: string; createdAt: string; usedAt: string | null; usedBy: string | null };
export type InvitesResponse = { invites: InviteDTO[] };

export type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  connections: {
    id: string; itemId: string; institution: string | null;
    /** Nome pra mostrar: o banco de verdade, mesmo quando a conexão vem pelo MeuPluggy. */
    displayName: string;
    lastSyncedAt: string | null; status: string;
    accounts: { id: string; name: string; type: 'BANK' | 'CREDIT'; balanceInCents: number; hidden: boolean }[];
  }[];
};

// ---------- Banco ----------
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const connectBankBody = z.object({
  // Item IDs do Pluggy são UUIDs. Se a pessoa colar um link ou texto com um UUID dentro, a gente pesca ele.
  itemId: z
    .string()
    .trim()
    .transform((v) => v.match(UUID)?.[0].toLowerCase() ?? v)
    .pipe(z.string().min(8, 'Item ID parece curto demais')),
});
export type ConnectBankBody = z.infer<typeof connectBankBody>;

export type SyncResponse = { importedCount: number; accounts: number };

/** providerDeleted = false quando o Pluggy não confirmou: aí vale revogar no meu.pluggy.ai. */
export type DisconnectResponse = { providerDeleted: boolean };

/** null quando a API roda com o banco de exemplo (sem widget). */
export type ConnectTokenResponse = { connectToken: string | null };

// ---------- Transações ----------
export const monthQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use AAAA-MM'),
});

/** Busca na Carteira: texto livre (loja, pessoa, categoria, banco) + filtros. */
export const searchQuery = z.object({
  q: z.string().trim().max(80).default(''),
  period: z.enum(['30d', '3m', '12m', 'tudo']).default('12m'),
  kind: z.enum(['todas', 'saida', 'entrada']).default('todas'),
  categoryId: z.string().optional(),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const manualTransactionBody = z.object({
  description: z.string().trim().min(1, 'Diz o que foi'),
  amountInCents: z.number().int().positive('Valor precisa ser maior que zero'),
  kind: z.enum(['saida', 'entrada']),
  occurredAt: z.iso.date(),
  categoryId: z.string().nullable().optional(),
  /** "Pago com": null = dinheiro vivo. */
  accountId: z.string().nullable().optional(),
});
export type ManualTransactionBody = z.infer<typeof manualTransactionBody>;

export const categorizeBody = z.object({
  categoryId: z.string().min(1),
  // Se true, cria uma regra: próximas transações com a mesma descrição caem nessa categoria
  remember: z.boolean().default(false),
});
export type CategorizeBody = z.infer<typeof categorizeBody>;

export type TransactionDTO = {
  id: string;
  description: string;
  amountInCents: number;
  occurredAt: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryEmoji: string | null;
  categoryColor: string | null;
  accountName: string | null;
  isInternalTransfer: boolean;
  source: 'bank' | 'manual';
};

export type SearchResponse = {
  transactions: TransactionDTO[];
  /** Total achado (a lista vem cortada em 200). */
  count: number;
  outInCents: number;
  inInCents: number;
};

/** kind "neutra" = "Não conta" (some do gasto e da renda). custom = criada pela pessoa. */
export type CategoryDTO = { id: string; name: string; emoji: string; color: string; kind: 'saida' | 'entrada' | 'neutra'; custom: boolean };

export const createCategoryBody = z.object({
  name: z.string().trim().min(2, 'Nome curto demais').max(30, 'Nome longo demais'),
  emoji: z.string().trim().max(16).default('🏷️'),
  kind: z.enum(['saida', 'entrada']),
});
export type CreateCategoryBody = z.infer<typeof createCategoryBody>;

export type MonthSummaryResponse = {
  month: string;
  balanceInCents: number | null; // null quando não tem banco conectado
  incomeInCents: number;
  outcomeInCents: number;
  uncategorizedCount: number;
  byCategory: { categoryId: string | null; name: string; color: string; totalInCents: number }[];
  /** BANK = conta corrente (entra no saldo); CREDIT = cartão (balance = fatura em aberto). */
  accounts: { id: string; name: string; type: 'BANK' | 'CREDIT'; balanceInCents: number; creditLimitInCents: number | null; dueDate: string | null }[];
  /** Contas que a pessoa ocultou: fora do saldo e da lista. */
  hiddenAccounts: { id: string; name: string; balanceInCents: number }[];
};

export type TransactionDetailResponse = { transaction: TransactionDTO; rulePattern: string };

// ---------- Assinaturas ----------
export type SubscriptionDTO = {
  key: string;
  name: string;
  amountInCents: number; // positivo: quanto custa por mês
  chargeCount: number;
  lastChargedAt: string;
  nextChargeAt: string;
  active: boolean; // false = não cobrou no último ciclo
  installmentsLeft: number | null; // plano parcelado: quantas parcelas faltam
};
export type SubscriptionsResponse = { subscriptions: SubscriptionDTO[]; ignored: SubscriptionDTO[]; monthlyInCents: number; yearlyInCents: number };
export const ignoreSubscriptionBody = z.object({ key: z.string().min(1).max(200), ignored: z.boolean() });

// ---------- Limites por categoria ----------
export const setBudgetBody = z.object({
  // null tira o limite
  limitInCents: z.number().int().positive('O limite precisa ser maior que zero').max(100_000_000).nullable(),
});
export type SetBudgetBody = z.infer<typeof setBudgetBody>;
export type BudgetDTO = { categoryId: string; name: string; emoji: string; color: string; limitInCents: number; spentInCents: number };
export type BudgetsResponse = { budgets: BudgetDTO[] };

// ---------- Progresso das lições ----------
export const lessonIdParam = z.object({ lessonId: z.string().regex(/^m\d+-l\d+$/, 'Lição inválida') });
/** streakDays = ofensiva (dias seguidos com lição); doneToday = lições feitas hoje (Brasília). */
export type LessonProgressResponse = { done: string[]; streakDays: number; doneToday: number };

// Chat com o Tostão
export const chatBody = z.object({ message: z.string().trim().min(1, 'Escreve alguma coisa').max(1000, 'Pergunta longa demais') });
export type ChatMessageDTO = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
export type ChatHistoryResponse = { messages: ChatMessageDTO[] };
export type ChatReplyResponse = { question: ChatMessageDTO; reply: ChatMessageDTO; remainingToday: number };

// Importar extrato (OFX/CSV)
export const importStatementBody = z.object({
  accountName: z.string().trim().max(40).default(''),
  fileName: z.string().max(200),
  content: z.string().min(10, 'Arquivo vazio').max(4_000_000, 'Arquivo grande demais (máx. 4 MB)'),
  isCard: z.boolean().optional(),
});
export type ImportResponse = { importedCount: number; skipped: number; format: 'ofx' | 'csv'; kind: 'BANK' | 'CREDIT'; accountName: string; from: string; to: string };

// ---------- Renda, contas fixas e previsão ----------
const cents = z.number().int().min(0).max(100_000_000);
const day = z.number().int().min(1).max(31);
/** A meta (uma só por pessoa). savedInCents = quanto já guardou; o app soma com "Guardei". */
export const goalBody = z.object({
  kind: z.enum(['reserva', 'viagem', 'sair-do-vermelho', 'outro']),
  label: z.string().trim().max(60).nullable().default(null),
  amountInCents: cents.nullable().default(null),
  deadline: z.string().regex(/^\d{4}-\d{2}$/).nullable().default(null),
  savedInCents: cents.optional(),
});
export type Goal = z.infer<typeof goalBody>;
/** "Guardei R$ 50" (positivo) ou "tirei R$ 20" (negativo). */
export const goalDepositBody = z.object({ amountInCents: z.number().int().min(-100_000_000).max(100_000_000).refine((v) => v !== 0, 'Valor precisa ser diferente de zero') });

export const financialPlanBody = z.object({
  salary: z.object({
    amountInCents: cents,
    payday: day,
    varies: z.boolean().default(false),
    bank: z.string().trim().max(60).nullable().default(null),
    /** Adiantamento: parte do salário que cai antes, ex.: metade no dia 15. amountInCents é o total do mês. */
    advance: z.object({ day, amountInCents: cents }).nullable().default(null),
    /** Padrão da descrição no extrato (ex.: "TRANSF SALDO C/SAL P/CC"). */
    pattern: z.string().trim().max(120).nullable().default(null),
  }).nullable(),
  otherIncomes: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    amountInCents: cents,
    day: day.nullable().default(null),
    countsAsIncome: z.boolean(),
    pattern: z.string().trim().max(120).nullable().default(null),
  })).max(10).default([]),
  fixedExpenses: z.array(z.object({ name: z.string().trim().min(1).max(60), amountInCents: cents, day })).max(20).default([]),
  /** VR e VA: não passam pelo Open Finance, a pessoa informa. Só servem pra comida, não entram no caixa. */
  benefits: z.array(z.object({ kind: z.enum(['VR', 'VA', 'outro']), amountInCents: cents, day })).max(4).default([]),
  goal: goalBody.nullable().default(null),
});
export type FinancialPlan = z.infer<typeof financialPlanBody>;
export type FinancialPlanResponse = { plan: FinancialPlan | null };

/** Entradas que se repetem no extrato, pra pessoa dizer o que é salário e o que é repasse. */
export type IncomeSuggestion = {
  pattern: string;
  sample: string;
  bank: string | null;
  monthlyAvgInCents: number;
  months: number;
  hits: { date: string; amountInCents: number }[];
  countsAsIncome: boolean;
};
export type IncomeSuggestionsResponse = { suggestions: IncomeSuggestion[] };

export type ForecastMonth = {
  month: string;
  incomeInCents: number;
  fixedInCents: number;
  subscriptionsInCents: number;
  installmentsInCents: number;
  dailyInCents: number;
  leftInCents: number;
  /** VR/VA do mês: informativo, não entra no leftInCents. */
  benefitsInCents: number;
};
/** Situação da meta: quanto falta e quanto guardar por mês pra chegar no prazo. */
export type GoalStatus = {
  label: string;
  amountInCents: number | null;
  savedInCents: number;
  deadline: string | null;
  monthsLeft: number | null;
  /** null = sem valor ou sem prazo. */
  monthlyNeededInCents: number | null;
  /** O que sobra no mês que vem dá pra guardar o mensal da meta? null = sem previsão. */
  fits: boolean | null;
  reached: boolean;
};
export type ForecastResponse = { hasPlan: boolean; months: ForecastMonth[]; goal: GoalStatus | null };
/** Quantas pendentes a IA categorizou (das que ela olhou). */
export type AutoCategorizeResponse = { categorized: number; asked: number };
