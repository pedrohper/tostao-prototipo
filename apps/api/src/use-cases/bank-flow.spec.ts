import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { CategorizeTransactionUseCase } from './categorize-transaction.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { DisconnectBankUseCase } from './disconnect-bank.js';

const NOW = new Date(Date.UTC(2026, 10, 20, 18)); // 20/11/2026
const MONTH = '2026-11';

describe('fluxo do banco (conectar → sincronizar → resumo → categorizar)', () => {
  let repos: ReturnType<typeof makeInMemoryRepositories>;
  let connect: ConnectBankUseCase;
  let sync: SyncBankConnectionUseCase;

  beforeEach(() => {
    repos = makeInMemoryRepositories();
    const bank = new FakeBankGateway(() => NOW);
    sync = new SyncBankConnectionUseCase({ ...repos, bank, now: () => NOW });
    connect = new ConnectBankUseCase(repos.connections, bank, sync);
  });

  it('importa e não duplica ao sincronizar de novo', async () => {
    const first = await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    expect(first.importedCount).toBe(12);
    const again = await sync.execute({ connectionId: first.connection.id });
    expect(again.importedCount).toBe(0);
    expect(repos.transactions.items).toHaveLength(12);
  });

  it('resumo bate com as telas e ignora o Pix entre contas', async () => {
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const summary = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    expect(summary.balanceInCents).toBe(84230); // R$ 842,30
    expect(summary.incomeInCents).toBe(130790); // R$ 1.307,90 (sem os R$ 100 do Pix interno)
    expect(summary.outcomeInCents).toBe(46560); // R$ 465,60
    expect(summary.uncategorizedCount).toBe(1); // PAG*RESTAURANTESABOR
  });

  it('categorizar com "lembrar" cria regra e fecha o Delivery em R$ 312,40', async () => {
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const pending = await repos.transactions.findUncategorized('u1');
    const restaurante = pending.find((t) => t.description.includes('RESTAURANTESABOR'))!;
    await new CategorizeTransactionUseCase(repos).execute({ userId: 'u1', transactionId: restaurante.id, categoryId: 'delivery', remember: true });

    const summary = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    expect(summary.uncategorizedCount).toBe(0);
    expect(summary.byCategory[0]).toMatchObject({ categoryId: 'delivery', totalInCents: 31240 });
    expect(repos.rules.items.some((r) => r.userId === 'u1' && r.pattern === 'PAG*RESTAURANTESABOR')).toBe(true);
  });

  it('não deixa categorizar transação de outra pessoa', async () => {
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const tx = repos.transactions.items[0]!;
    await expect(
      new CategorizeTransactionUseCase(repos).execute({ userId: 'intruso', transactionId: tx.id, categoryId: 'delivery', remember: false }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('desconectar apaga contas e transações do banco, mas mantém o que foi anotado na mão', async () => {
    const { connection } = await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    await repos.transactions.create({ userId: 'u1', accountId: null, externalId: null, description: 'PASTEL', amountInCents: -800, occurredAt: NOW, categoryId: null, isInternalTransfer: false });
    const disconnect = new DisconnectBankUseCase(repos.connections, new FakeBankGateway(() => NOW));

    await expect(disconnect.execute({ userId: 'intruso', connectionId: connection.id })).rejects.toBeInstanceOf(ResourceNotFoundError);

    expect(await disconnect.execute({ userId: 'u1', connectionId: connection.id })).toEqual({ providerDeleted: true });
    expect(repos.connections.items).toHaveLength(0);
    expect(repos.accounts.items).toHaveLength(0);
    expect(repos.transactions.items.map((t) => t.description)).toEqual(['PASTEL']);
  });

  it('desconectar apaga aqui mesmo se o provedor falhar', async () => {
    const { connection } = await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const broken = Object.assign(new FakeBankGateway(() => NOW), { deleteItem: async () => { throw new Error('fora do ar'); } });
    expect(await new DisconnectBankUseCase(repos.connections, broken).execute({ userId: 'u1', connectionId: connection.id })).toEqual({ providerDeleted: false });
    expect(repos.connections.items).toHaveLength(0);
  });
});
