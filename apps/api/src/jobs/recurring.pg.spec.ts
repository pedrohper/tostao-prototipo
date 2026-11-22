// T5.2 contra Postgres REAL: a garantia de "nunca duplica" não depende de memória nem de lock.
// Só roda com TEST_DATABASE_URL (banco descartável com as migrations). TEST_REDIS_URL é opcional (lock de verdade).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemoryKeyValueStore, RedisKeyValueStore, type KeyValueStore } from '../lib/redis.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { CreateManualAccountUseCase } from '../use-cases/create-manual-account.js';
import { CreateManualTransactionUseCase } from '../use-cases/create-manual-transaction.js';
import { RecurringRulesUseCase } from '../use-cases/recurring-rules.js';
import { dueAt } from '../services/recurrence.js';
import { applyDueScheduledBalances } from '../services/recurring-materializer.js';
import { materializeAll, RECURRING_LOCK_KEY } from './recurring.js';

const url = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const silent = { info: () => undefined, error: () => undefined, warn: () => undefined };
const TZ = 'America/Sao_Paulo';

describe.skipIf(!url)('T5.2 recorrências e agendados no Postgres real', () => {
  let db: PrismaClient;
  let repos: ReturnType<typeof makePrismaRepositories>;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
    repos = makePrismaRepositories(db);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  async function newUserWithAccount(balance = 1000_00) {
    const user = await db.user.create({
      data: { name: 'Pessoa', email: `rec-${randomUUID().slice(0, 8)}@x.com`, passwordHash: 'x' },
    });
    const { account } = await new CreateManualAccountUseCase(repos).execute({
      userId: user.id,
      name: 'Carteira',
      type: 'BANK',
      balanceInCents: balance,
    });
    const balanceNow = async () =>
      Number((await db.account.findUniqueOrThrow({ where: { id: account.id } })).balanceInCents);
    return { user, account, balanceNow };
  }
  const body = (accountId: string, over: Record<string, unknown> = {}) => ({
    description: 'Aluguel',
    amountInCents: 300_00,
    kind: 'saida' as const,
    frequency: 'MONTHLY' as const,
    startDate: '2026-11-25',
    accountId,
    autoPost: true,
    ...over,
  });

  it('DUAS rodadas ao mesmo tempo (sem lock compartilhado): 1 lançamento, saldo aplicado 1 vez, regra avançou 1 vez', async () => {
    const { user, account, balanceNow } = await newUserWithAccount();
    const rules = new RecurringRulesUseCase(repos, () => new Date('2026-11-01T00:00:00Z'));
    const { rule } = await rules.create(user.id, body(account.id));
    const day = new Date('2026-11-25T16:00:00Z');
    // kv diferentes de propósito: o lock NÃO ajuda aqui, só o Postgres.
    const results = await Promise.all(
      Array.from({ length: 6 }, () => materializeAll(repos, new MemoryKeyValueStore(), day, silent)),
    );
    expect(results.reduce((s, r) => s + (r.posted ?? 0), 0)).toBe(1);
    const rows = await db.transaction.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.externalId).toBe(`rec:${rule.id}:2026-11`);
    expect(Number(rows[0]!.amountInCents)).toBe(-300_00);
    expect(rows[0]!.balanceAppliedAt).not.toBeNull();
    expect(await balanceNow()).toBe(700_00);
    const after = await db.recurringRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(after.postedInstallments).toBe(1);
    expect(after.nextRunAt.toISOString()).toBe(dueAt('2026-12-25', TZ).toISOString());
  });

  it('parcelado com várias rodadas simultâneas: exatamente N parcelas, nunca N+1, regra desligada no fim', async () => {
    const { user, account, balanceNow } = await newUserWithAccount();
    const rules = new RecurringRulesUseCase(repos, () => new Date('2026-11-01T00:00:00Z'));
    const { rule } = await rules.create(
      user.id,
      body(account.id, {
        description: 'Celular',
        amountInCents: 100_00,
        startDate: '2026-12-01',
        totalInstallments: 4,
      }),
    );
    const late = new Date('2027-06-01T16:00:00Z');
    await Promise.all(Array.from({ length: 5 }, () => materializeAll(repos, new MemoryKeyValueStore(), late, silent)));
    await materializeAll(repos, new MemoryKeyValueStore(), late, silent);
    const rows = await db.transaction.findMany({ where: { userId: user.id }, orderBy: { occurredAt: 'asc' } });
    expect(rows.map((r) => r.description)).toEqual([
      'Celular (1/4)',
      'Celular (2/4)',
      'Celular (3/4)',
      'Celular (4/4)',
    ]);
    expect(new Set(rows.map((r) => r.externalId)).size).toBe(4);
    expect(await balanceNow()).toBe(1000_00 - 400_00);
    const after = await db.recurringRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(after.active).toBe(false);
    expect(after.postedInstallments).toBe(4);
  });

  it('lançamento futuro em conta manual: o saldo é aplicado UMA vez mesmo com 6 rodadas simultâneas', async () => {
    const { user, account, balanceNow } = await newUserWithAccount();
    const now = new Date('2026-11-20T16:00:00Z');
    await new CreateManualTransactionUseCase(repos, () => now).execute({
      userId: user.id,
      description: 'Parcela futura',
      amountInCents: 75_00,
      kind: 'saida',
      occurredAt: dueAt('2026-12-10', TZ),
      accountId: account.id,
    });
    expect(await balanceNow()).toBe(1000_00);
    const arrived = new Date('2026-12-10T16:00:00Z');
    const applied = await Promise.all(
      Array.from({ length: 6 }, () => applyDueScheduledBalances(repos, arrived, silent)),
    );
    expect(applied.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1); // outros testes podem ter linhas vencidas no mesmo banco
    expect(await balanceNow()).toBe(925_00); // a NOSSA conta: uma vez só
    await applyDueScheduledBalances(repos, arrived, silent);
    expect(await balanceNow()).toBe(925_00);
    const row = await db.transaction.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.balanceAppliedAt).not.toBeNull();
  });

  it('a trava do repositório: claimBalanceApplication devolve true UMA vez só, mesmo em corrida', async () => {
    const { user, account } = await newUserWithAccount();
    const t = await db.transaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        description: 'x',
        amountInCents: -10n,
        occurredAt: new Date(),
        isInternalTransfer: false,
      },
    });
    const wins = await Promise.all(
      Array.from({ length: 10 }, () => repos.transactions.claimBalanceApplication(t.id, new Date())),
    );
    expect(wins.filter(Boolean)).toHaveLength(1);
  });

  it('o lock de verdade no Redis (se TEST_REDIS_URL): uma instância roda, a outra recebe ran:false', async () => {
    if (!redisUrl) return;
    const kv: KeyValueStore = new RedisKeyValueStore(redisUrl, `t52:${randomUUID().slice(0, 6)}:`);
    try {
      expect(await kv.setnx(RECURRING_LOCK_KEY, 'a', 30)).toBe(true);
      expect(await kv.setnx(RECURRING_LOCK_KEY, 'b', 30)).toBe(false);
      expect(await materializeAll(repos, kv, new Date(), silent)).toEqual({ ran: false });
      expect(await kv.delIfEquals(RECURRING_LOCK_KEY, 'b')).toBe(false); // só o dono libera
      expect(await kv.delIfEquals(RECURRING_LOCK_KEY, 'a')).toBe(true);
      expect((await materializeAll(repos, kv, new Date(), silent)).ran).toBe(true);
    } finally {
      await kv.del(RECURRING_LOCK_KEY);
      await (kv as RedisKeyValueStore).client.quit();
    }
  });

  describe('backfill da migration (balance_applied_at)', () => {
    it('marca o que já pesava (data <= criação) em conta MANUAL e deixa o futuro e as contas conectadas em paz', async () => {
      const { user, account } = await newUserWithAccount();
      const conn = await db.bankConnection.create({
        data: { userId: user.id, itemId: `item-${randomUUID()}`, institution: 'Banco' },
      });
      const bankAcc = await db.account.create({
        data: {
          userId: user.id,
          connectionId: conn.id,
          externalId: `pl-${randomUUID()}`,
          name: 'Banco',
          type: 'BANK',
          balanceInCents: 0n,
        },
      });
      const created = new Date('2026-11-10T12:00:00Z');
      const mk = (accountId: string, occurredAt: Date) =>
        db.transaction.create({
          data: {
            userId: user.id,
            accountId,
            description: 'x',
            amountInCents: -1000n,
            occurredAt,
            createdAt: created,
            isInternalTransfer: false,
          },
        });
      const past = await mk(account.id, new Date('2026-11-09T12:00:00Z'));
      const future = await mk(account.id, new Date('2026-12-09T12:00:00Z'));
      const connected = await mk(bankAcc.id, new Date('2026-11-09T12:00:00Z'));

      const sql = readFileSync(
        new URL('../../prisma/migrations/20261125100000_t52_recurring_rules/migration.sql', import.meta.url),
        'utf8',
      );
      const update = /UPDATE "transactions" t[\s\S]*?;/.exec(sql)![0]!;
      // Mesmo UPDATE da migration, só restrito a esta pessoa (o banco de teste é compartilhado com outras suítes).
      const scoped = update.replace(
        'WHERE t."account_id" = a."id"',
        `WHERE t."user_id" = '${user.id}' AND t."account_id" = a."id"`,
      );
      await db.$executeRawUnsafe('UPDATE "transactions" SET "balance_applied_at" = NULL WHERE "user_id" = $1', user.id);
      await db.$executeRawUnsafe(scoped);

      const get = (id: string) => db.transaction.findUniqueOrThrow({ where: { id } });
      expect((await get(past.id)).balanceAppliedAt?.toISOString()).toBe(created.toISOString());
      expect((await get(future.id)).balanceAppliedAt).toBeNull();
      expect((await get(connected.id)).balanceAppliedAt).toBeNull();
    });
  });

  it('apagar a conta não apaga a regra (SET NULL): vira "dinheiro" sem conta e continua lançando', async () => {
    const { user, account } = await newUserWithAccount();
    const rules = new RecurringRulesUseCase(repos, () => new Date('2026-11-01T00:00:00Z'));
    const { rule } = await rules.create(user.id, body(account.id));
    await repos.accounts.delete(account.id);
    expect((await db.recurringRule.findUniqueOrThrow({ where: { id: rule.id } })).accountId).toBeNull();
    await materializeAll(repos, new MemoryKeyValueStore(), new Date('2026-11-25T16:00:00Z'), silent);
    const t = await db.transaction.findFirstOrThrow({ where: { userId: user.id, externalId: { startsWith: 'rec:' } } });
    expect(t.accountId).toBeNull();
  });

  it('CHECKs do banco: valor zero, dia 32 e parcela além do total são barrados', async () => {
    const { user } = await newUserWithAccount();
    const base = {
      userId: user.id,
      kind: 'saida' as const,
      description: 'x',
      frequency: 'MONTHLY' as const,
      nextRunAt: new Date(),
    };
    await expect(db.recurringRule.create({ data: { ...base, amountInCents: 0n, dayOfMonth: 1 } })).rejects.toThrow();
    await expect(db.recurringRule.create({ data: { ...base, amountInCents: 1n, dayOfMonth: 32 } })).rejects.toThrow();
    await expect(
      db.recurringRule.create({
        data: { ...base, amountInCents: 1n, dayOfMonth: 1, totalInstallments: 3, postedInstallments: 4 },
      }),
    ).rejects.toThrow();
  });
});
