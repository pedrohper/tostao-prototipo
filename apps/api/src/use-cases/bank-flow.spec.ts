import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { SyncBankConnectionUseCase } from './sync-bank-connection.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { CategorizeTransactionUseCase } from './categorize-transaction.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { DisconnectBankUseCase } from './disconnect-bank.js';
import { CreateCategoryUseCase, DeleteCategoryUseCase } from './categories.js';
import { makeUseCases } from './factories.js';

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
    await new CategorizeTransactionUseCase(repos).execute({
      userId: 'u1',
      transactionId: restaurante.id,
      categoryId: 'delivery',
      remember: true,
    });

    const summary = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    expect(summary.uncategorizedCount).toBe(0);
    expect(summary.byCategory[0]).toMatchObject({ categoryId: 'delivery', totalInCents: 31240 });
    expect(repos.rules.items.some((r) => r.userId === 'u1' && r.pattern === 'PAG*RESTAURANTESABOR')).toBe(true);
  });

  it('não deixa categorizar transação de outra pessoa', async () => {
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const tx = repos.transactions.items[0]!;
    await expect(
      new CategorizeTransactionUseCase(repos).execute({
        userId: 'intruso',
        transactionId: tx.id,
        categoryId: 'delivery',
        remember: false,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it('desconectar apaga contas e transações do banco, mas mantém o que foi anotado na mão', async () => {
    const { connection } = await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    await repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: null,
      description: 'PASTEL',
      amountInCents: -800,
      occurredAt: NOW,
      categoryId: null,
      isInternalTransfer: false,
    });
    const disconnect = new DisconnectBankUseCase(repos, new FakeBankGateway(() => NOW));

    await expect(disconnect.execute({ userId: 'intruso', connectionId: connection.id })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );

    expect(await disconnect.execute({ userId: 'u1', connectionId: connection.id })).toEqual({ providerDeleted: true });
    expect(repos.connections.items).toHaveLength(0);
    expect(repos.accounts.items).toHaveLength(0);
    expect(repos.transactions.items.map((t) => t.description)).toEqual(['PASTEL']);
  });

  it('desconectar apaga aqui mesmo se o provedor falhar', async () => {
    const { connection } = await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const broken = Object.assign(new FakeBankGateway(() => NOW), {
      deleteItem: async () => {
        throw new Error('fora do ar');
      },
    });
    expect(
      await new DisconnectBankUseCase(repos, broken).execute({ userId: 'u1', connectionId: connection.id }),
    ).toEqual({ providerDeleted: false });
    expect(repos.connections.items).toHaveLength(0);
  });

  it('"Não conta" tira o repasse do resumo, e a regra pega os próximos sozinha', async () => {
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const before = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    const salario = repos.transactions.items.find((t) => t.amountInCents > 0 && !t.isInternalTransfer)!;

    await new CategorizeTransactionUseCase(repos).execute({
      userId: 'u1',
      transactionId: salario.id,
      categoryId: 'nao-conta',
      remember: true,
    });
    const after = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    expect(after.incomeInCents).toBe(before.incomeInCents - salario.amountInCents);
    expect(repos.transactions.items.find((t) => t.id === salario.id)!.isInternalTransfer).toBe(true);

    // sincronizar de novo não desfaz
    await sync.execute({ connectionId: repos.connections.items[0]!.id });
    expect(repos.transactions.items.find((t) => t.id === salario.id)!.isInternalTransfer).toBe(true);

    // mudou de ideia: volta a contar
    await new CategorizeTransactionUseCase(repos).execute({
      userId: 'u1',
      transactionId: salario.id,
      categoryId: 'salario',
      remember: false,
    });
    const back = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    expect(back.incomeInCents).toBe(before.incomeInCents);
  });

  it('categoria própria: só o dono vê, usa e apaga; apagar devolve as transações pra pendente', async () => {
    await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const { category } = await new CreateCategoryUseCase(repos).execute({
      userId: 'u1',
      name: 'Freela',
      emoji: '💻',
      kind: 'saida',
    });
    await expect(
      new CreateCategoryUseCase(repos).execute({ userId: 'u1', name: 'freela', emoji: '', kind: 'saida' }),
    ).rejects.toThrow('Já tem');

    expect((await repos.categories.list('u1')).some((c) => c.id === category.id)).toBe(true);
    expect((await repos.categories.list('u2')).some((c) => c.id === category.id)).toBe(false);

    const gasto = repos.transactions.items.find((t) => t.amountInCents < 0 && !t.isInternalTransfer)!;
    await expect(
      new CategorizeTransactionUseCase(repos).execute({
        userId: 'u2',
        transactionId: gasto.id,
        categoryId: category.id,
        remember: false,
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await new CategorizeTransactionUseCase(repos).execute({
      userId: 'u1',
      transactionId: gasto.id,
      categoryId: category.id,
      remember: true,
    });

    const del = new DeleteCategoryUseCase(repos);
    await expect(del.execute({ userId: 'u2', categoryId: category.id })).rejects.toBeInstanceOf(ResourceNotFoundError);
    await expect(del.execute({ userId: 'u1', categoryId: 'mercado' })).rejects.toBeInstanceOf(ResourceNotFoundError); // do sistema, não
    await del.execute({ userId: 'u1', categoryId: category.id });
    expect(repos.transactions.items.find((t) => t.id === gasto.id)!.categoryId).toBeNull();
    expect(repos.rules.items.some((r) => r.categoryId === category.id)).toBe(false);
  });

  it('conta oculta sai do saldo e da lista, e continua oculta depois do sync', async () => {
    const { connection } = await connect.execute({ userId: 'u1', itemId: 'item-123456' });
    const uc = makeUseCases({ repos, bank: new FakeBankGateway(() => NOW) });
    const before = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    const conta = repos.accounts.items[0]!;

    await expect(
      uc.setAccountHidden.execute({ userId: 'intruso', accountId: conta.id, hidden: true }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
    await uc.setAccountHidden.execute({ userId: 'u1', accountId: conta.id, hidden: true });
    await sync.execute({ connectionId: connection.id });

    const after = await new GetMonthSummaryUseCase(repos).execute({ userId: 'u1', month: MONTH });
    expect(after.accounts.map((a) => a.id)).not.toContain(conta.id);
    expect(after.hiddenAccounts.map((a) => a.id)).toEqual([conta.id]);
    expect(after.balanceInCents).not.toBe(before.balanceInCents);
  });

  describe('mesmo cartão em duas conexões (Bradesco e Bradescard)', () => {
    // Cada conexão devolve o mesmo cartão Elo final 8335, com id diferente no provedor
    class CardGateway extends FakeBankGateway {
      constructor(private readonly withFingerprint: boolean) {
        super(() => NOW);
      }
      override async fetchAccounts(itemId: string) {
        return [
          {
            externalId: `${itemId}:bradesco`,
            name: 'ELO MAIS',
            type: 'CREDIT' as const,
            balanceInCents: -17282,
            fingerprint: this.withFingerprint ? 'CREDIT:ELO:8335' : null,
          },
        ];
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

  it('usa merchantName e categoria do provedor como fallback na sincronização, mas regra do usuário vence', async () => {
    class EnrichedGateway extends FakeBankGateway {
      override async fetchAccounts() {
        return [{ externalId: 'acc-enr', name: 'Nubank', type: 'BANK' as const, balanceInCents: 10000 }];
      }
      override async fetchTransactions() {
        return [
          {
            externalId: 'tx-bistro',
            description: 'BISTRO DA PRACA',
            amountInCents: -4500,
            occurredAt: NOW,
            providerCategory: 'Eating out',
          },
          {
            externalId: 'tx-dl',
            description: 'DL*VIAGEM',
            amountInCents: -1990,
            occurredAt: NOW,
            merchantName: 'Uber',
            providerCategory: 'Services',
          },
          {
            externalId: 'tx-override',
            description: 'UBER *CURSO',
            amountInCents: -3000,
            occurredAt: NOW,
            merchantName: 'Uber',
            providerCategory: 'Taxi and ride-hailing',
          },
        ];
      }
    }

    await repos.rules.upsert({ userId: 'u1', pattern: 'UBER *CURSO', categoryId: 'estudo' });
    const gw = new EnrichedGateway(() => NOW);
    const s = new SyncBankConnectionUseCase({ ...repos, bank: gw, now: () => NOW });
    const c = new ConnectBankUseCase(repos.connections, gw, s);
    await c.execute({ userId: 'u1', itemId: 'item-enr' });

    const byExt = new Map(repos.transactions.items.map((t) => [t.externalId, t.categoryId]));
    expect(byExt.get('tx-bistro')).toBe('comer-fora');
    expect(byExt.get('tx-dl')).toBe('transporte');
    expect(byExt.get('tx-override')).toBe('estudo');
  });

  it('reconstrói o saldo final dos meses anteriores desfazendo movimentações da conta BANK até hoje', async () => {
    const conn = await repos.connections.create({ userId: 'u1', itemId: 'item-hist', institution: 'Nubank' });
    const bankAcc = await repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'acc-bank',
      name: 'Conta Nubank',
      type: 'BANK',
      balanceInCents: 100000, // R$ 1.000,00 hoje (20/11)
      fingerprint: null,
    });
    const cardAcc = await repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'acc-card',
      name: 'Cartão Nubank',
      type: 'CREDIT',
      balanceInCents: -20000,
      fingerprint: null,
    });

    // Movimentos de novembro (após fechamento de outubro)
    await repos.transactions.create({
      userId: 'u1',
      accountId: bankAcc.id,
      externalId: 'nov-in',
      description: 'Salário novembro',
      amountInCents: 50000, // +500
      occurredAt: new Date('2026-11-05T12:00:00Z'),
      categoryId: 'salario',
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: 'u1',
      accountId: bankAcc.id,
      externalId: 'nov-bill',
      description: 'Pagamento fatura cartão',
      amountInCents: -20000, // -200 (saiu da conta mesmo sendo transferência interna)
      occurredAt: new Date('2026-11-10T12:00:00Z'),
      categoryId: null,
      isInternalTransfer: true,
    });
    // Compra no cartão em novembro: não altera saldo da conta corrente
    await repos.transactions.create({
      userId: 'u1',
      accountId: cardAcc.id,
      externalId: 'nov-card',
      description: 'Mercado no cartão',
      amountInCents: -15000,
      occurredAt: new Date('2026-11-12T12:00:00Z'),
      categoryId: 'mercado',
      isInternalTransfer: false,
    });
    // Anotação manual em dinheiro (sem accountId) e lançamento futuro: não alteram saldo do banco
    await repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: null,
      description: 'Café dinheiro',
      amountInCents: -1200,
      occurredAt: new Date('2026-11-14T12:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });
    await repos.transactions.create({
      userId: 'u1',
      accountId: bankAcc.id,
      externalId: null,
      description: 'Agendamento futuro',
      amountInCents: -30000,
      occurredAt: new Date('2026-12-05T12:00:00Z'),
      categoryId: null,
      isInternalTransfer: false,
    });

    const summaryUseCase = new GetMonthSummaryUseCase(repos, () => NOW);
    const nov = await summaryUseCase.execute({ userId: 'u1', month: '2026-11' });
    expect(nov.balanceInCents).toBe(100000);

    // Fim de outubro = 1000 - (500 - 200) = 700,00 (70000 centavos)
    const oct = await summaryUseCase.execute({ userId: 'u1', month: '2026-10' });
    expect(oct.balanceInCents).toBe(70000);
    expect(oct.accounts.find((a) => a.id === bankAcc.id)?.balanceInCents).toBe(70000);
  });
});
