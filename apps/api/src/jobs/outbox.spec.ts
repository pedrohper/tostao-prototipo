import { describe, expect, it, vi } from 'vitest';
import { BankConnectionError } from '../domain/errors.js';
import type { BankGateway } from '../gateways/bank-gateway.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { DeleteAccountUseCase } from '../use-cases/delete-account.js';
import { backoffMs, processOutbox } from './outbox.js';

// O job é enfileirado com o relógio REAL (DeleteAccountUseCase não recebe relógio); o processador usa o relógio do
// teste. T0 precisa ficar um pouco À FRENTE do agora real, senão (como aconteceu quando uma data fixa ficou pra trás)
// o job nasce "no futuro" do relógio do teste e nunca está vencido. Folga de 1 min: a suíte roda em milissegundos.
const T0 = new Date(Date.now() + 60_000);
const silent = { info: vi.fn(), error: vi.fn() };

function setup() {
  const repos = makeInMemoryRepositories();
  const bank: BankGateway = new FakeBankGateway();
  const deleted: string[] = [];
  let fail = false;
  bank.deleteItem = async (id: string) => {
    if (fail) throw new BankConnectionError('Pluggy fora do ar');
    deleted.push(id);
  };
  let now = T0;
  return {
    repos,
    bank,
    deleted,
    setFail: (v: boolean) => (fail = v),
    clock: () => now,
    tick: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

describe('outbox: desligar o Item do Pluggy depois que o provedor falhou', () => {
  it('apagar a conta com o Pluggy fora do ar enfileira o job; a conta some mesmo assim; o job é refeito depois', async () => {
    const s = setup();
    const user = await s.repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: null });
    await s.repos.connections.create({ userId: user.id, itemId: 'item-pluggy-1', institution: 'Nubank' });
    s.setFail(true);

    const r = await new DeleteAccountUseCase(s.repos, s.bank).execute({ userId: user.id, confirmEmail: 'a@x.com' });
    expect(r.providerFailures).toBe(1);
    expect(await s.repos.users.count()).toBe(0);
    expect(s.repos.outbox.items).toHaveLength(1);
    expect(s.repos.outbox.items[0]).toMatchObject({
      type: 'pluggy.deleteItem',
      status: 'PENDING',
      payload: { itemId: 'item-pluggy-1' },
    });
    // auditoria: o evento existe, sem o id da pessoa
    expect(s.repos.audit.items).toHaveLength(1);
    expect(s.repos.audit.items[0]).toMatchObject({ action: 'account_deleted', userId: null, entityId: null });

    // ainda fora do ar: tenta, falha, reagenda com espera
    const first = await processOutbox(s.repos, s.bank, { now: s.clock, log: silent });
    expect(first).toEqual({ done: 0, retried: 1, failed: 0 });
    expect(s.repos.outbox.items[0]!.attempts).toBe(1);
    expect(s.repos.outbox.items[0]!.runAt.getTime()).toBe(T0.getTime() + backoffMs(1));

    // antes da hora: não mexe
    expect(await processOutbox(s.repos, s.bank, { now: s.clock, log: silent })).toEqual({
      done: 0,
      retried: 0,
      failed: 0,
    });

    // provedor voltou e a espera passou: conclui
    s.setFail(false);
    s.tick(backoffMs(1) + 1);
    expect(await processOutbox(s.repos, s.bank, { now: s.clock, log: silent })).toEqual({
      done: 1,
      retried: 0,
      failed: 0,
    });
    expect(s.deleted).toEqual(['item-pluggy-1']);
    expect(s.repos.outbox.items[0]).toMatchObject({ status: 'DONE', lastError: null });
  });

  it('desiste depois de maxAttempts (FAILED) e não loga o id do Item', async () => {
    const s = setup();
    await s.repos.outbox.enqueue({ type: 'pluggy.deleteItem', payload: { itemId: 'item-secreto' }, maxAttempts: 2 });
    s.setFail(true);
    const log = { info: vi.fn(), error: vi.fn() };
    await processOutbox(s.repos, s.bank, { now: s.clock, log });
    s.tick(backoffMs(1) + 1);
    expect(await processOutbox(s.repos, s.bank, { now: s.clock, log })).toEqual({ done: 0, retried: 0, failed: 1 });
    expect(s.repos.outbox.items[0]).toMatchObject({ status: 'FAILED', attempts: 2 });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('item-secreto');
    s.tick(10 * 24 * 3600_000);
    expect(await processOutbox(s.repos, s.bank, { now: s.clock, log })).toEqual({ done: 0, retried: 0, failed: 0 });
  });

  it('dois processadores ao mesmo tempo não fazem o mesmo job duas vezes', async () => {
    const s = setup();
    for (let i = 0; i < 6; i++)
      await s.repos.outbox.enqueue({ type: 'pluggy.deleteItem', payload: { itemId: `item-${i}` } });
    await Promise.all([
      processOutbox(s.repos, s.bank, { now: s.clock, log: silent, limit: 6 }),
      processOutbox(s.repos, s.bank, { now: s.clock, log: silent, limit: 6 }),
    ]);
    expect(s.deleted.sort()).toEqual(['item-0', 'item-1', 'item-2', 'item-3', 'item-4', 'item-5']);
  });

  it('job com payload quebrado ou tipo desconhecido não derruba o processador', async () => {
    const s = setup();
    await s.repos.outbox.enqueue({ type: 'pluggy.deleteItem', payload: {} });
    expect(await processOutbox(s.repos, s.bank, { now: s.clock, log: silent })).toMatchObject({ retried: 1 });
  });

  it('backoff: 5 min, 10, 20... e nunca passa de 6 h', () => {
    expect([1, 2, 3].map((n) => backoffMs(n) / 60_000)).toEqual([5, 10, 20]);
    expect(backoffMs(20)).toBe(6 * 60 * 60_000);
  });
});
