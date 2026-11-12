// Entidades do domínio: o formato "puro" dos dados, sem Prisma, sem HTTP.
// Os use cases só conhecem isso aqui. Trocar o banco não muda nada nesse arquivo.

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
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
  /** Ocultada pela pessoa: some da tela e do saldo, mas continua sincronizando. */
  hidden: boolean;
};

/** kind "neutra" = não conta como gasto nem renda (ex.: repasse com a família). userId null = categoria do sistema. */
export type Category = { id: string; name: string; emoji: string; color: string; kind: 'saida' | 'entrada' | 'neutra'; userId?: string | null };

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
  createdAt: Date;
};

export type CategoryBudget = { id: string; userId: string; categoryId: string; limitInCents: number };

export type LessonProgress = { userId: string; lessonId: string; completedAt: Date };
