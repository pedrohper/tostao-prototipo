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
  connections: { id: string; itemId: string; institution: string | null; lastSyncedAt: string | null; status: string }[];
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

export const manualTransactionBody = z.object({
  description: z.string().trim().min(1, 'Diz o que foi'),
  amountInCents: z.number().int().positive('Valor precisa ser maior que zero'),
  kind: z.enum(['saida', 'entrada']),
  occurredAt: z.iso.date(),
  categoryId: z.string().nullable().optional(),
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
  accountName: string | null;
  isInternalTransfer: boolean;
  source: 'bank' | 'manual';
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
  accounts: { id: string; name: string; balanceInCents: number }[];
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
export type LessonProgressResponse = { done: string[] };

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
