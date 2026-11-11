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
};

export type Category = { id: string; name: string; emoji: string; color: string; kind: 'saida' | 'entrada' };

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
