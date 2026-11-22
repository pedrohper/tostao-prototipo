// T5.2 · job de materialização (em memória): lança recorrências vencidas, aplica agendados e NUNCA duplica.
// A prova contra Postgres real (concorrência de verdade) está em recurring.pg.spec.ts.
import { describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { CreateManualAccountUseCase } from '../use-cases/create-manual-account.js';
import { CreateManualTransactionUseCase } from '../use-cases/create-manual-transaction.js';
import { RecurringRulesUseCase } from '../use-cases/recurring-rules.js';
import { dueAt } from '../services/recurrence.js';
import { RECURRING_LOCK_KEY, materializeAll } from './recurring.js';

const silent = { info: () => undefined, error: () => undefined, warn: () => undefined };
const TZ = 'America/Sao_Paulo';

async function setup(now = new Date('2026-11-20T16:00:00Z')) {
  const repos = makeInMemoryRepositories();
  const kv = new MemoryKeyValueStore();
  const { account } = await new CreateManualAccountUseCase(repos).execute({
    userId: 'u1',
    name: 'Carteira',
    type: 'BANK',
    balanceInCents: 1000_00,
  });
  const rules = new RecurringRulesUseCase(repos, () => now);
  const balance = async () => (await repos.accounts.listByUser('u1')).find((a) => a.id === account.id)!.balanceInCents;
  return { repos, kv, account, rules, balance };
}
const base = (accountId: string, over: Record<string, unknown> = {}) => ({
  description: 'Aluguel',
  amountInCents: 300_00,
  kind: 'saida' as const,
  frequency: 'MONTHLY' as const,
  startDate: '2026-11-20',
  accountId,
  autoPost: true,
  ...over,
});

describe('recorrências: idempotência', () => {
  it('rodar duas vezes no mesmo dia NÃO duplica o lançamento nem o saldo', async () => {
    const { repos, kv, account, rules, balance } = await setup();
    // Criada com data futura (não materializa na criação), depois "o dia chega".
    await rules.create('u1', base(account.id, { startDate: '2026-11-25' }));
    const later = new Date('2026-11-25T16:00:00Z');
    const first = await materializeAll(repos, kv, later, silent);
    const second = await materializeAll(repos, kv, later, silent);
    expect(first.posted).toBe(1);
    expect(second.posted).toBe(0);
    const txs = (await repos.transactions.findManualByUser('u1')).concat(
      await repos.transactions.findManyInRange(
        'u1',
        new Date('2026-11-01T00:00:00Z'),
        new Date('2026-12-31T00:00:00Z'),
      ),
    );
    expect(new Set(txs.map((t) => t.id)).size).toBe(1);
    expect(await balance()).toBe(1000_00 - 300_00); // saldo mexeu UMA vez
  });

  it('o externalId é rec:<regra>:<AAAA-MM> e o lançamento fica no dia civil da pessoa', async () => {
    const { repos, kv, account, rules } = await setup();
    const { rule } = await rules.create('u1', base(account.id, { startDate: '2026-11-25' }));
    await materializeAll(repos, kv, new Date('2026-11-25T16:00:00Z'), silent);
    const t = await repos.transactions.findByExternalId('u1', `rec:${rule.id}:2026-11`);
    expect(t).not.toBeNull();
    expect(t!.amountInCents).toBe(-300_00);
    expect(t!.occurredAt.toISOString()).toBe(dueAt('2026-11-25', TZ).toISOString());
    expect(t!.description).toBe('Aluguel');
  });

  it('não lança antes do vencimento (meio-dia do dia civil da pessoa)', async () => {
    const { repos, kv, account, rules } = await setup();
    await rules.create('u1', base(account.id, { startDate: '2026-11-25' }));
    // 24/11 às 23h (Brasília): ainda não é o dia 25.
    const r = await materializeAll(repos, kv, new Date('2026-11-25T02:00:00Z'), silent);
    expect(r.posted).toBe(0);
    // 25/11 ao meio-dia (15:00Z): vence.
    expect((await materializeAll(repos, kv, new Date('2026-11-25T15:00:00Z'), silent)).posted).toBe(1);
  });

  it('data de início já chegada: lança na criação (sem esperar o job) e o job não repete', async () => {
    const { repos, kv, account, rules, balance } = await setup();
    const { rule } = await rules.create('u1', base(account.id, { startDate: '2026-11-20' }));
    expect(rule.postedInstallments).toBe(1);
    expect(rule.nextRunAt).toBe(dueAt('2026-12-20', TZ).toISOString());
    expect(await balance()).toBe(700_00);
    expect((await materializeAll(repos, kv, new Date('2026-11-20T18:00:00Z'), silent)).posted).toBe(0);
    expect(await balance()).toBe(700_00);
  });

  it('parcelado: lança N parcelas e DESLIGA a regra; descrição com n/total', async () => {
    const { repos, kv, account, rules, balance } = await setup();
    const { rule } = await rules.create(
      'u1',
      base(account.id, {
        description: 'Notebook',
        startDate: '2026-12-05',
        totalInstallments: 3,
        amountInCents: 100_00,
      }),
    );
    // o servidor ficou parado: tudo vencido de uma vez, em ordem
    const r = await materializeAll(repos, kv, new Date('2027-03-01T15:00:00Z'), silent);
    expect(r.posted).toBe(3);
    const after = (await repos.recurring.findById(rule.id))!;
    expect(after.active).toBe(false);
    expect(after.postedInstallments).toBe(3);
    const all = await repos.transactions.findManyInRange(
      'u1',
      new Date('2026-12-01T00:00:00Z'),
      new Date('2027-04-01T00:00:00Z'),
    );
    expect(all.map((t) => t.description).sort()).toEqual(['Notebook (1/3)', 'Notebook (2/3)', 'Notebook (3/3)']);
    expect(await balance()).toBe(1000_00 - 300_00);
    expect((await materializeAll(repos, kv, new Date('2027-04-01T15:00:00Z'), silent)).posted).toBe(0);
  });

  it('entrada (salário) soma no saldo; dia 31 cai no último dia dos meses curtos', async () => {
    const { repos, kv, account, rules, balance } = await setup(new Date('2026-12-01T12:00:00Z'));
    const { rule } = await rules.create(
      'u1',
      base(account.id, { description: 'Salário', kind: 'entrada', amountInCents: 2000_00, startDate: '2026-12-31' }),
    );
    await materializeAll(repos, kv, new Date('2026-12-31T15:00:00Z'), silent);
    await materializeAll(repos, kv, new Date('2027-02-28T15:00:00Z'), silent); // fev/2027: dia 28
    expect(await balance()).toBe(1000_00 + 2000_00 + 2000_00 + 2000_00); // dez, jan (31) e fev (28)
    expect(await repos.transactions.findByExternalId('u1', `rec:${rule.id}:2027-02`)).not.toBeNull();
  });

  it('autoPost=false só alimenta a previsão: o job não lança', async () => {
    const { repos, kv, account, rules } = await setup();
    await rules.create('u1', base(account.id, { startDate: '2026-11-25', autoPost: false }));
    expect((await materializeAll(repos, kv, new Date('2026-11-26T15:00:00Z'), silent)).posted).toBe(0);
  });

  it('o lançamento que a pessoa já anotou com a mesma chave não duplica: o job só avança a regra', async () => {
    const { repos, kv, account, rules, balance } = await setup();
    const { rule } = await rules.create('u1', base(account.id, { startDate: '2026-11-25' }));
    await repos.transactions.create({
      userId: 'u1',
      accountId: account.id,
      externalId: `rec:${rule.id}:2026-11`,
      description: 'Aluguel',
      amountInCents: -300_00,
      occurredAt: dueAt('2026-11-25', TZ),
      categoryId: null,
      isInternalTransfer: false,
      balanceAppliedAt: new Date('2026-11-25T15:00:00Z'), // a rodada anterior já pesou no saldo (e o saldo dela já está no seed)
    });
    const r = await materializeAll(repos, kv, new Date('2026-11-25T15:30:00Z'), silent);
    expect(r.posted).toBe(0);
    expect((await repos.recurring.findById(rule.id))!.postedInstallments).toBe(1);
    expect(await balance()).toBe(1000_00); // nada foi aplicado em cima
  });

  it('regra de OUTRA pessoa nunca mexe na conta dela', async () => {
    const { repos, kv, account, rules } = await setup();
    await expect(rules.create('intruso', base(account.id))).rejects.toMatchObject({ statusCode: 404 });
    void repos;
    void kv;
  });

  it('conta ligada ao banco é recusada (o banco já traz o lançamento; seria em dobro)', async () => {
    const { repos, rules } = await setup();
    const conn = await repos.connections.create({ userId: 'u1', itemId: 'item-real', institution: 'Banco' });
    const bankAccount = await repos.accounts.upsertByExternalId({
      userId: 'u1',
      connectionId: conn.id,
      externalId: 'pluggy-1',
      name: 'Conta',
      type: 'BANK',
      balanceInCents: 0,
      fingerprint: null,
    });
    await expect(rules.create('u1', base(bankAccount.id))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('agendados: lançamento futuro em conta manual', () => {
  it('não pesa quando é criado; pesa UMA vez quando a data chega (rodar de novo não repete)', async () => {
    const now = new Date('2026-11-20T16:00:00Z');
    const { repos, kv, account, balance } = await setup(now);
    await new CreateManualTransactionUseCase(repos, () => now).execute({
      userId: 'u1',
      description: 'Parcela',
      amountInCents: 50_00,
      kind: 'saida',
      occurredAt: dueAt('2026-12-05', TZ),
      accountId: account.id,
    });
    expect(await balance()).toBe(1000_00); // futuro: não mexe
    expect((await materializeAll(repos, kv, new Date('2026-12-04T15:00:00Z'), silent)).applied).toBe(0);
    const day = new Date('2026-12-05T15:30:00Z');
    expect((await materializeAll(repos, kv, day, silent)).applied).toBe(1);
    expect(await balance()).toBe(950_00);
    expect((await materializeAll(repos, kv, day, silent)).applied).toBe(0);
    expect(await balance()).toBe(950_00);
  });

  it('lançamento anotado já no passado não é aplicado de novo pelo job', async () => {
    const now = new Date('2026-11-20T16:00:00Z');
    const { repos, kv, account, balance } = await setup(now);
    await new CreateManualTransactionUseCase(repos, () => now).execute({
      userId: 'u1',
      description: 'Mercado',
      amountInCents: 80_00,
      kind: 'saida',
      occurredAt: new Date('2026-11-18T15:00:00Z'),
      accountId: account.id,
    });
    expect(await balance()).toBe(920_00);
    expect((await materializeAll(repos, kv, now, silent)).applied).toBe(0);
    expect(await balance()).toBe(920_00);
  });
});

describe('lock distribuído', () => {
  it('com o lock ocupado por outra instância, a rodada não roda (ran: false) e não toca em nada', async () => {
    const { repos, kv, account, rules, balance } = await setup();
    await rules.create('u1', base(account.id, { startDate: '2026-11-25' }));
    await kv.set(RECURRING_LOCK_KEY, 'outra-replica', 60);
    const r = await materializeAll(repos, kv, new Date('2026-11-25T16:00:00Z'), silent);
    expect(r).toEqual({ ran: false });
    expect(await balance()).toBe(1000_00);
    // a outra instância terminou: a rodada passa a rodar
    await kv.del(RECURRING_LOCK_KEY);
    expect((await materializeAll(repos, kv, new Date('2026-11-25T16:00:00Z'), silent)).posted).toBe(1);
  });

  it('libera o lock ao terminar (a próxima rodada consegue)', async () => {
    const { repos, kv } = await setup();
    await materializeAll(repos, kv, new Date(), silent);
    expect(await kv.get(RECURRING_LOCK_KEY)).toBeNull();
  });

  it('Redis fora do ar: roda assim mesmo (a idempotência do banco é quem protege)', async () => {
    const { repos, account, rules, balance } = await setup();
    await rules.create('u1', base(account.id, { startDate: '2026-11-25' }));
    const broken = new MemoryKeyValueStore();
    broken.setnx = async () => {
      throw new Error('ECONNREFUSED');
    };
    const r = await materializeAll(repos, broken, new Date('2026-11-25T16:00:00Z'), silent);
    expect(r.posted).toBe(1);
    expect(await balance()).toBe(700_00);
  });
});

describe('fuso: America/Manaus', () => {
  it('o vencimento é o meio-dia de MANAUS (16:00Z), não o de Brasília', async () => {
    const { repos, kv, account } = await setup();
    await repos.users.create({ name: 'Manauara', email: 'm@x.com', passwordHash: 'x' } as never);
    const u = (await repos.users.findByEmail('m@x.com'))!;
    (u as { timezone: string }).timezone = 'America/Manaus';
    // regra do usuário de Manaus em conta nenhuma (dinheiro)
    const rules = new RecurringRulesUseCase(repos, () => new Date('2026-11-01T00:00:00Z'));
    void account;
    const { rule } = await rules.create(u.id, base(null as never, { accountId: null, startDate: '2026-11-25' }));
    expect(rule.nextRunAt).toBe('2026-11-25T16:00:00.000Z');
    expect((await materializeAll(repos, kv, new Date('2026-11-25T15:59:00Z'), silent)).posted).toBe(0);
    expect((await materializeAll(repos, kv, new Date('2026-11-25T16:00:00Z'), silent)).posted).toBe(1);
  });
});
