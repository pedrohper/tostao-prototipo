import type { BankAccountData, BankGateway, BankItemData, BankTransactionData } from './bank-gateway.js';

/**
 * Banco de mentira com os números das telas do protótipo.
 * Usa o mês atual, então sempre tem dado "de agora". Serve pra testar sem Pluggy.
 * Qualquer Item ID funciona.
 */
export class FakeBankGateway implements BankGateway {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async createConnectToken(): Promise<string | null> {
    return null; // sem widget: a tela mostra só o campo de texto
  }

  async fetchItem(): Promise<BankItemData> {
    return { institution: 'Banco de exemplo' };
  }

  async fetchAccounts(itemId: string): Promise<BankAccountData[]> {
    return [
      { externalId: `${itemId}:nubank`, name: 'Nubank', type: 'BANK', balanceInCents: 31210 },
      { externalId: `${itemId}:mp`, name: 'Mercado Pago', type: 'BANK', balanceInCents: 20470 },
      { externalId: `${itemId}:bradesco`, name: 'Bradesco', type: 'BANK', balanceInCents: 32550 },
    ];
  }

  async fetchTransactions(accountExternalId: string, from: Date, to: Date): Promise<BankTransactionData[]> {
    const n = this.now();
    // dia D do mês atual, sem passar de hoje
    const day = (d: number) => {
      const date = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), Math.min(d, n.getUTCDate()), 15));
      return date > n ? n : date; // no dia de hoje antes das 15h, não cria transação no futuro
    };
    const key = accountExternalId.split(':').pop();
    const data: Record<string, [string, number, number][]> = {
      nubank: [
        ['TED RECEBIDA ACME LTDA SALARIO', 130790, 1],
        ['IFD*BURGER KING', -4290, 2],
        ['SPOTIFY', -2190, 3],
        ['PIX ENVIADO PEDRO H MERCADO PAGO', -10000, 4],
        ['IFOOD *PIZZARIA BELLA', -5800, 6],
        ['ASSAI ATACADISTA', -7340, 8],
        ['IFD*MCDONALDS', -3650, 10],
        ['PAG*RESTAURANTESABOR', -6850, 12],
      ],
      mp: [
        ['PIX RECEBIDO PEDRO H NUBANK', 10000, 4],
        ['RAPPI*SUSHI DA VILA', -6460, 7],
        ['NETFLIX.COM', -5790, 9],
      ],
      bradesco: [['IFD*ACAI DO ZE', -4190, 11]],
    };
    return (data[key ?? ''] ?? [])
      .map(([description, amountInCents, d], i) => ({
        externalId: `${accountExternalId}:${n.getUTCFullYear()}-${n.getUTCMonth() + 1}:${i}`,
        description,
        amountInCents,
        occurredAt: day(d),
      }))
      .filter((t) => t.occurredAt >= from && t.occurredAt <= to);
  }
}
