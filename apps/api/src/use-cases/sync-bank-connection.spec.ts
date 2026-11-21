// T1.5 · sync do banco: lançamento só com data, transferências manuais, janela de pareamento e falhas seguidas.
import { describe, expect, it } from 'vitest';
import type { BankAccountData, BankTransactionData } from '../gateways/bank-gateway.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { BankConnectionError } from '../domain/errors.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ConnectBankUseCase } from './connect-bank.js';
import { MAX_SYNC_FAILURES, openBill, SyncBankConnectionUseCase } from './sync-bank-connection.js';

const brt = (iso: string) => new Date(`${iso}-03:00`);

/** Banco roteirizado: devolve as contas e transações que o teste mandar. */
class ScriptedGateway extends FakeBankGateway {
  failNext = false;
  accounts: BankAccountData[] = [{ externalId: 'cc', name: 'Corrente', type: 'BANK', balanceInCents: 100_00 }];
  txs: Record<string, BankTransactionData[]> = {};
  constructor() {
    super();
  }
  override async fetchAccounts() {
    if (this.failNext) throw new BankConnectionError('banco fora do ar');
    return this.accounts;
  }
  override async fetchTransactions(id: string) {
    return this.txs[id] ?? [];
  }
}

async function setup(now: Date, gw = new ScriptedGateway()) {
  const repos = makeInMemoryRepositories();
  let clock = now;
  const sync = new SyncBankConnectionUseCase({ ...repos, bank: gw, now: () => clock });
  const { connection } = await new ConnectBankUseCase(repos.connections, gw, sync).execute({
    userId: 'u1',
    itemId: 'item-sync-1',
  });
  return { repos, gw, sync, connection, setNow: (d: Date) => (clock = d) };
}

describe('data sem hora (date-only) vale até o FIM do dia civil', () => {
  it('sync às 09h de Brasília traz o lançamento de HOJE que o banco só deu o dia (antes sumia: meio-dia > agora)', async () => {
    const gw = new ScriptedGateway();
    gw.txs.cc = [
      // Pluggy: "2026-11-20T00:00:00.000Z" -> guardado como meio-dia de Brasília do dia 20
      {
        externalId: 't-hoje',
        description: 'PADARIA',
        amountInCents: -12_00,
        occurredAt: brt('2026-11-20T12:00:00'),
        dateOnly: true,
      },
      {
        externalId: 't-amanha',
        description: 'PARCELA FUTURA',
        amountInCents: -50_00,
        occurredAt: brt('2026-11-21T12:00:00'),
        dateOnly: true,
      },
    ];
    const { repos, connection, sync } = await setup(brt('2026-11-20T09:00:00'), gw);
    // (o connect já sincronizou uma vez às 09h)
    const ids = repos.transactions.items.map((t) => t.externalId);
    expect(ids).toContain('t-hoje');
    expect(ids).not.toContain('t-amanha');
    // e continua igual no sync seguinte
    await sync.execute({ connectionId: connection.id });
    expect(repos.transactions.items.map((t) => t.externalId)).toEqual(['t-hoje']);
  });

  it('com hora de verdade, o futuro continua de fora: 20/11 às 15h não entra num sync das 09h', async () => {
    const gw = new ScriptedGateway();
    gw.txs.cc = [
      {
        externalId: 't-tarde',
        description: 'COMPRA TARDE',
        amountInCents: -9_00,
        occurredAt: brt('2026-11-20T15:00:00'),
      },
      {
        externalId: 't-manha',
        description: 'COMPRA MANHA',
        amountInCents: -8_00,
        occurredAt: brt('2026-11-20T08:00:00'),
      },
    ];
    const { repos } = await setup(brt('2026-11-20T09:00:00'), gw);
    expect(repos.transactions.items.map((t) => t.externalId)).toEqual(['t-manha']);
  });

  it('openBill (Nubank): compra do dia sem hora entra na fatura aberta mesmo de manhã', () => {
    const remote = { balanceInCents: 0, dueDate: null, institution: 'Nubank' };
    const fetched: BankTransactionData[] = [
      {
        externalId: 'a',
        description: 'IFOOD',
        amountInCents: -30_00,
        occurredAt: brt('2026-11-20T12:00:00'),
        dateOnly: true,
        billId: null,
      },
      {
        externalId: 'b',
        description: 'ANTIGA',
        amountInCents: -10_00,
        occurredAt: brt('2026-11-10T12:00:00'),
        dateOnly: true,
        billId: 'fechada',
      },
      {
        externalId: 'c',
        description: 'FUTURA',
        amountInCents: -99_00,
        occurredAt: brt('2026-11-25T12:00:00'),
        dateOnly: true,
        billId: null,
      },
    ];
    expect(openBill(remote, fetched, brt('2026-11-20T09:00:00'))).toBe(-30_00);
    // quem tem hora e ainda não aconteceu fica de fora
    const withTime = [{ ...fetched[0]!, dateOnly: false, occurredAt: brt('2026-11-20T15:00:00') }, fetched[1]!];
    expect(openBill(remote, withTime, brt('2026-11-20T09:00:00'))).toBe(0);
  });
});

describe('transferências internas e decisão manual', () => {
  const pair = (day = '2026-11-18T12:00:00') => {
    const gw = new ScriptedGateway();
    gw.accounts = [
      { externalId: 'nu', name: 'Nubank', type: 'BANK', balanceInCents: 0 },
      { externalId: 'mp', name: 'Mercado Pago', type: 'BANK', balanceInCents: 0 },
    ];
    gw.txs.nu = [{ externalId: 'out', description: 'PIX ENVIADO JOAO', amountInCents: -100_00, occurredAt: brt(day) }];
    gw.txs.mp = [{ externalId: 'in', description: 'PIX RECEBIDO JOAO', amountInCents: 100_00, occurredAt: brt(day) }];
    return gw;
  };

  it('par espelhado vira transferência interna', async () => {
    const { repos } = await setup(brt('2026-11-20T10:00:00'), pair());
    expect(repos.transactions.items.every((t) => t.isInternalTransfer)).toBe(true);
  });

  it('o que a pessoa DESMARCOU não volta a ser marcado pelo sync (internalTransferManual = false)', async () => {
    const { repos, connection, sync } = await setup(brt('2026-11-20T10:00:00'), pair());
    const out = repos.transactions.items.find((t) => t.externalId === 'out')!;
    await repos.transactions.save({ ...out, isInternalTransfer: false, internalTransferManual: false });
    await sync.execute({ connectionId: connection.id });
    const after = repos.transactions.items.find((t) => t.externalId === 'out')!;
    expect(after.isInternalTransfer).toBe(false);
    expect(after.internalTransferManual).toBe(false);
    // e o outro lado, sem decisão, não pareia sozinho (o par foi desfeito pela pessoa)
    expect(repos.transactions.items.find((t) => t.externalId === 'in')!.isInternalTransfer).toBe(false);
  });

  it('o que a pessoa MARCOU continua marcado, mesmo sem par e sem palavra-chave', async () => {
    const gw = new ScriptedGateway();
    gw.txs.cc = [
      {
        externalId: 'solo',
        description: 'PAGAMENTO LOJA XYZ',
        amountInCents: -40_00,
        occurredAt: brt('2026-11-18T12:00:00'),
      },
    ];
    const { repos, connection, sync } = await setup(brt('2026-11-20T10:00:00'), gw);
    const t = repos.transactions.items[0]!;
    await repos.transactions.save({ ...t, isInternalTransfer: true, internalTransferManual: true });
    await sync.execute({ connectionId: connection.id });
    expect(repos.transactions.items[0]!.isInternalTransfer).toBe(true);
  });

  it('boleto/TED que compensa 3 dias depois ainda pareia (janela de 3 dias)', async () => {
    const gw = pair();
    gw.txs.mp = [
      { externalId: 'in', description: 'TED RECEBIDA', amountInCents: 100_00, occurredAt: brt('2026-11-19T12:00:00') },
    ];
    gw.txs.nu = [
      { externalId: 'out', description: 'TED ENVIADA', amountInCents: -100_00, occurredAt: brt('2026-11-16T12:00:00') },
    ];
    const { repos } = await setup(brt('2026-11-20T10:00:00'), gw);
    expect(repos.transactions.items.every((t) => t.isInternalTransfer)).toBe(true);
  });

  it('lado de par na borda da janela NÃO é desmarcado quando o outro lado ficou fora', async () => {
    const { repos, connection, sync, setNow, gw } = await setup(
      brt('2026-11-20T10:00:00'),
      pair('2026-11-18T12:00:00'),
    );
    expect(repos.transactions.items.every((t) => t.isInternalTransfer)).toBe(true);
    // Muito tempo depois: o sync só enxerga os últimos dias e o par está longe, na borda inferior da janela.
    // O outro lado (mp) não vem mais da API; o que ficou no banco NÃO pode virar gasto por isso.
    gw.txs.mp = [];
    const out = repos.transactions.items.find((t) => t.externalId === 'out')!;
    setNow(new Date(out.occurredAt.getTime() + 60 * 24 * 3600_000));
    await repos.connections.save({
      ...(await repos.connections.findById(connection.id))!,
      lastSyncedAt: new Date(out.occurredAt.getTime() + 55 * 24 * 3600_000),
    });
    await sync.execute({ connectionId: connection.id });
    expect(repos.transactions.items.find((t) => t.externalId === 'out')!.isInternalTransfer).toBe(true);
  });
});

describe('falhas seguidas do sync', () => {
  it('1ª e 2ª falha: ERROR com contagem; 3ª: RECONNECT_REQUIRED; sucesso zera tudo', async () => {
    const { repos, connection, sync, gw, setNow } = await setup(brt('2026-11-20T10:00:00'));
    gw.failNext = true;
    for (let i = 1; i <= MAX_SYNC_FAILURES; i++) {
      setNow(brt(`2026-11-2${i}T10:00:00`));
      await expect(sync.execute({ connectionId: connection.id })).rejects.toBeInstanceOf(BankConnectionError);
      const c = (await repos.connections.findById(connection.id))!;
      expect(c.errorCount).toBe(i);
      expect(c.lastErrorAt).toEqual(brt(`2026-11-2${i}T10:00:00`));
      expect(c.status).toBe(i >= MAX_SYNC_FAILURES ? 'RECONNECT_REQUIRED' : 'ERROR');
    }
    // a pessoa reconectou/tentou de novo e deu certo: zera
    gw.failNext = false;
    setNow(brt('2026-11-25T10:00:00'));
    await sync.execute({ connectionId: connection.id });
    const ok = (await repos.connections.findById(connection.id))!;
    expect(ok).toMatchObject({ status: 'ACTIVE', errorCount: 0, lastErrorAt: null });
  });
});
