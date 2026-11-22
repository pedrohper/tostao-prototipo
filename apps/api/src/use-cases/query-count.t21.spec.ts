// T2.1 · Quantas queries SQL cada tela dispara, contado pelo log do Prisma contra Postgres REAL.
// Só roda com TEST_DATABASE_URL (banco descartável com as migrations aplicadas).
// Tetos do doc: GET /forecast ≤ 6, POST /chat ≤ 10 (snapshot ≤ 8), GET /people ≤ 3.
// T5.2 somou UMA query deliberada à previsão (as regras de lançamento automático: `recurring_rules` ativas), então os dois
// que passam por `loadForecastData` ficam em 7 e 11. Continua sendo 1 query por tabela, nada de N+1.
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedFinanceFixture, FIXTURE_NOW } from '../test-support/finance-fixture.js';
import { FakeAiGateway } from '../gateways/ai-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { AskTostaoUseCase } from './ask-tostao.js';
import { ForecastUseCase } from './financial-plan.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { GetSummaryHistoryUseCase } from './get-summary-history.js';
import { ListPeopleUseCase } from './people.js';

const url = process.env.TEST_DATABASE_URL;
const NOW = FIXTURE_NOW;

describe.skipIf(!url)('T2.1 contagem de queries (Postgres real)', () => {
  let db: PrismaClient;
  let repos: ReturnType<typeof makePrismaRepositories>;
  let queries: string[] = [];
  let userId = '';

  beforeAll(async () => {
    db = new PrismaClient({ datasourceUrl: url, log: [{ emit: 'event', level: 'query' }] });
    (db as unknown as { $on: (e: 'query', cb: (q: { query: string }) => void) => void }).$on('query', (q) => {
      // BEGIN/COMMIT não são consulta de dado: só conta o que lê ou escreve.
      if (/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(q.query)) queries.push(q.query);
    });
    repos = makePrismaRepositories(db);

    userId = (await seedFinanceFixture(db, repos)).userId;
  });

  afterAll(async () => {
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => {});
    await db?.$disconnect();
  });

  const measure = async <T>(label: string, fn: () => Promise<T>) => {
    queries = [];
    const result = await fn();
    console.log(`[queries] ${label}: ${queries.length}`);
    return { result, count: queries.length };
  };

  it('GET /forecast ≤ 7 queries (6 do T2.1 + as regras automáticas)', async () => {
    const { result, count } = await measure('forecast', () =>
      new ForecastUseCase(repos, () => NOW).execute({ userId }),
    );
    expect(result.hasPlan).toBe(true);
    expect(result.months).toHaveLength(3);
    expect(count).toBeLessThanOrEqual(7);
  });

  it('POST /chat ≤ 11 queries (10 do T2.1 + as regras automáticas)', async () => {
    const ai = new FakeAiGateway();
    const ask = new AskTostaoUseCase(repos, ai, 40, () => NOW, new MemoryKeyValueStore());
    const { result, count } = await measure('chat', () => ask.execute({ userId, message: 'Quanto gastei?' }));
    expect(result.reply.content.length).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(11);
  });

  it('GET /people ≤ 3 queries', async () => {
    const { result, count } = await measure('people', () => new ListPeopleUseCase(repos).execute({ userId }));
    expect(result.people).toHaveLength(5);
    expect(count).toBeLessThanOrEqual(3);
  });

  it('o resumo do mês isolado continua barato (≤ 4 queries)', async () => {
    const { count } = await measure('summary', () =>
      new GetMonthSummaryUseCase(repos, () => NOW).execute({ userId, month: '2026-11' }),
    );
    expect(count).toBeLessThanOrEqual(4);
  });

  it('T4.3 · evolução de 6 meses da Home ≤ 4 queries (uma janela só, não uma por mês)', async () => {
    const { result, count } = await measure('history', () =>
      new GetSummaryHistoryUseCase(repos, () => NOW).execute({ userId, month: '2026-11', months: 6 }),
    );
    expect(result.months).toHaveLength(6);
    expect(count).toBeLessThanOrEqual(4);
  });
});
