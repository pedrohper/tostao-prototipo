// Contratos compartilhados entre a API e a web.
// Tudo que atravessa a rede passa por aqui: o schema Zod valida na API
// e o tipo inferido (z.infer) tipa a web. Um lugar só pra mudar.
import { z } from 'zod';

// ---------- Auth ----------
export const registerBody = z.object({
  name: z.string().trim().min(2, 'Nome muito curto'),
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres'),
});
export type RegisterBody = z.infer<typeof registerBody>;

export const loginBody = z.object({
  email: z.email('E-mail inválido').transform((e) => e.toLowerCase()),
  password: z.string().min(1, 'Digite a senha'),
});
export type LoginBody = z.infer<typeof loginBody>;

export type AuthResponse = { token: string };

export type ProfileResponse = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  connections: { id: string; itemId: string; institution: string | null; lastSyncedAt: string | null; status: string }[];
};

// ---------- Banco ----------
export const connectBankBody = z.object({
  itemId: z.string().trim().min(8, 'Item ID parece curto demais'),
});
export type ConnectBankBody = z.infer<typeof connectBankBody>;

export type SyncResponse = { importedCount: number; accounts: number };

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

export type CategoryDTO = { id: string; name: string; emoji: string; color: string };

export type MonthSummaryResponse = {
  month: string;
  balanceInCents: number | null; // null quando não tem banco conectado
  incomeInCents: number;
  outcomeInCents: number;
  uncategorizedCount: number;
  byCategory: { categoryId: string | null; name: string; color: string; totalInCents: number }[];
  accounts: { id: string; name: string; balanceInCents: number }[];
};
