// Contrato com "o banco". O use case de sincronizar só conhece isso.
// Implementações: PluggyBankGateway (de verdade) e FakeBankGateway (dados de exemplo / testes).

export type BankItemData = { institution: string | null };

export type BankAccountData = {
  externalId: string;
  name: string;
  type: 'BANK' | 'CREDIT';
  /** Conta: saldo disponível. Cartão: fatura em aberto, como NEGATIVO. */
  balanceInCents: number;
  /**
   * Cartão: "CREDIT:BANDEIRA:final". O mesmo cartão pode vir de dois conectores
   * (ex.: Bradesco e Bradescard) com ids diferentes; isso deixa a gente perceber.
   */
  fingerprint?: string | null;
  /** Cartão: limite total e vencimento da fatura atual. */
  creditLimitInCents?: number | null;
  dueDate?: Date | null;
};

export type BankTransactionData = {
  externalId: string;
  description: string;
  /** Já com sinal do Tostão: negativo = saiu. */
  amountInCents: number;
  occurredAt: Date;
};

export interface BankGateway {
  /**
   * Token curto (uns 30 min) pro widget Pluggy Connect abrir no navegador.
   * null = esse gateway não tem widget (o fake), então a tela usa só o campo manual.
   */
  createConnectToken(clientUserId: string): Promise<string | null>;
  fetchItem(itemId: string): Promise<BankItemData>;
  /** Apaga o Item no provedor. Se ele já não existe, não é erro. */
  deleteItem(itemId: string): Promise<void>;
  fetchAccounts(itemId: string): Promise<BankAccountData[]>;
  fetchTransactions(accountExternalId: string, from: Date, to: Date): Promise<BankTransactionData[]>;
}
