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

  describe('mesmo cartão em duas conexões (Bradesco e Bradescard)', () => {
    // Cada conexão devolve o mesmo cartão Elo final 8335, com id diferente no provedor
    class CardGateway extends FakeBankGateway {
      constructor(private readonly withFingerprint: boolean) { super(() => NOW); }
      override async fetchAccounts(itemId: string) {
        return [{ externalId: `${itemId}:bradesco`, name: 'ELO MAIS', type: 'CREDIT' as const, balanceInCents: -17282, fingerprint: this.withFingerprint ? 'CREDIT:ELO:8335' : null }];
      }
    }
    const setup = (gateway: FakeBankGateway) => {
      const s = new SyncBankConnectionUseCase({ ...repos, bank: gateway, now: () => NOW });
      return { sync: s, connect: new ConnectBankUseCase(repos.connections, gateway, s) };
    };
    const age = (itemId: string, iso: string) => {
      const c = repos.connections.items.find((x) => x.itemId === itemId)!;
      c.createdAt = new Date(iso);
      return c;
    };

    it('a conexão mais nova não importa o cartão de novo', async () => {
      const { connect } = setup(new CardGateway(true));
      await connect.execute({ userId: 'u1', itemId: 'bradesco' });
      age('bradesco', '2026-11-12T11:00:00Z');
      const second = await connect.execute({ userId: 'u1', itemId: 'bradescard' });

      expect(second.accounts).toBe(0);
      expect(repos.accounts.items).toHaveLength(1);
      expect(repos.transactions.items).toHaveLength(1); // IFD*ACAI DO ZE, uma vez só
    });

    it('limpa a cópia que já tinha entrado antes, qualquer que seja a ordem do sync', async () => {
      const old = setup(new CardGateway(false));
      await old.connect.execute({ userId: 'u1', itemId: 'bradesco' });
      await old.connect.execute({ userId: 'u1', itemId: 'bradescard' });
      const bradesco = age('bradesco', '2026-11-12T11:00:00Z');
      const bradescard = age('bradescard', '2026-11-12T12:01:00Z');
      expect(repos.transactions.items).toHaveLength(2); // o bug: duplicado

      const { sync: fixed } = setup(new CardGateway(true));
      await fixed.execute({ connectionId: bradescard.id }); // a mais nova sincroniza primeiro e ainda não acha o gêmeo marcado
      await fixed.execute({ connectionId: bradesco.id });
      await fixed.execute({ connectionId: bradescard.id }); // agora acha e apaga a cópia

      expect(repos.accounts.items.map((a) => a.connectionId)).toEqual([bradesco.id]);
      expect(repos.transactions.items).toHaveLength(1);
    });
  });
});
