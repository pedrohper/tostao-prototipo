import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import type { BankGateway } from '../gateways/bank-gateway.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { accountName } from '../gateways/pluggy-bank-gateway.js';
import { bankNameFromTransferNumber } from '../services/bank-names.js';
import { connectionName } from './get-profile.js';

const NOW = new Date('2026-11-12T15:00:00Z');

describe('cartão pelo MeuPluggy', () => {
  it('fatura aberta = limite usado menos parcelas futuras; parcela futura não vira gasto; banco vem do código', async () => {
    const repos = makeInMemoryRepositories();
    const bank: BankGateway = {
      createConnectToken: async () => 'x',
      deleteItem: async () => {},
      fetchItem: async () => ({ institution: 'MeuPluggy' }),
      fetchAccounts: async () => [
        { externalId: 'conta', name: 'Nubank', institution: 'Nubank', type: 'BANK', balanceInCents: 0 },
        { externalId: 'gold', name: 'Nubank Gold', institution: 'Nubank', type: 'CREDIT', balanceInCents: -56363, creditLimitInCents: 60000, dueDate: new Date('2026-11-03T03:00:00Z') },
      ],
      fetchTransactions: async (id: string, _from: Date, to: Date) => (id !== 'gold' ? [] : [
        { externalId: 'hoje', description: 'IFD*LANCHE', amountInCents: -3000, occurredAt: new Date('2026-11-10T15:00:00Z') },
        // depois de hoje mas antes do fechamento (26/11): ainda é da fatura atual
        { externalId: 'nov', description: 'GLOBOPLAY 3/6', amountInCents: -1390, occurredAt: new Date('2026-11-20T15:00:00Z') },
        { externalId: 'dez', description: 'AMAZON PRIME 2/12', amountInCents: -27630, occurredAt: new Date('2026-12-10T15:00:00Z') },
      ].filter((t) => t.occurredAt <= to)),
    } as unknown as BankGateway;
    const sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
    const connection = await repos.connections.create({ userId: 'u1', itemId: 'item-1', institution: 'MeuPluggy' });
    await sync.execute({ connectionId: connection.id });

    const card = repos.accounts.items.find((a) => a.externalId === 'gold')!;
    expect(card.balanceInCents).toBe(-28733); // 563,63 − 276,30 (a parcela de 20/11 fica) // R$ 273,43, o que o app do Nubank mostra
    expect(repos.transactions.items.map((t) => t.externalId)).toEqual(['hoje']);
    expect((await repos.connections.findById(connection.id))?.institution).toBe('Nubank');
  });

  it('nomes', () => {
    expect(bankNameFromTransferNumber('260/0001/123-4')).toBe('Nubank');
    expect(bankNameFromTransferNumber(null)).toBeNull();
    expect(accountName({ type: 'BANK', name: 'Nu Pagamentos S.A.', marketingName: 'Nu Pagamentos (Conta Pré-paga)', subtype: 'CHECKING_ACCOUNT' }, 'Nubank')).toBe('Nubank');
    expect(accountName({ type: 'BANK', name: 'Banco Bradesco', subtype: 'SAVINGS_ACCOUNT' }, 'Bradesco')).toBe('Bradesco (Poupança)');
    expect(accountName({ type: 'CREDIT', name: 'gold' }, 'Nubank')).toBe('Nubank Gold');
    expect(accountName({ type: 'CREDIT', name: 'Mercado Pago' }, 'Mercado Pago')).toBe('Mercado Pago');
    expect(accountName({ type: 'CREDIT', name: 'AMAZON MASTERCARD PLATINUM', marketingName: 'OUTROS' }, null)).toBe('Amazon Mastercard Platinum');
    expect(connectionName({ institution: 'MeuPluggy' }, [{ name: 'Amazon Mastercard Platinum', type: 'CREDIT' }])).toBe('Amazon Mastercard Platinum');
  });
});
