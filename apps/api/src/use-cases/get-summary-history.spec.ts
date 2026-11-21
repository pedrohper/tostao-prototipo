// T4.3 · GET /summary/history: evolução mensal da Home, com a mesma regra do resumo do mês.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { GetSummaryHistoryUseCase } from './get-summary-history.js';

const NOW = new Date('2026-11-20T15:00:00Z');

async function setup() {
  const repos = makeInMemoryRepositories();
  const tx = (o: { amountInCents: number; occurredAt: string; isInternalTransfer?: boolean; description?: string }) =>
    repos.transactions.create({
      userId: 'u1',
      accountId: null,
      externalId: null,
      description: o.description ?? 'x',
      amountInCents: o.amountInCents,
      occurredAt: new Date(o.occurredAt),
      categoryId: null,
      isInternalTransfer: o.isInternalTransfer ?? false,
    });
  await tx({ amountInCents: 3000_00, occurredAt: '2026-09-05T15:00:00Z' });
  await tx({ amountInCents: -800_00, occurredAt: '2026-09-10T15:00:00Z' });
  await tx({ amountInCents: -500_00, occurredAt: '2026-10-10T15:00:00Z' });
  await tx({ amountInCents: -999_00, occurredAt: '2026-10-11T15:00:00Z', isInternalTransfer: true });
  await tx({ amountInCents: 3200_00, occurredAt: '2026-11-05T15:00:00Z' });
  await tx({ amountInCents: -120_00, occurredAt: '2026-11-08T15:00:00Z' });
  return { repos, uc: new GetSummaryHistoryUseCase(repos, () => NOW) };
}

describe('GetSummaryHistoryUseCase', () => {
  it('devolve N meses do mais antigo ao pedido, sem buraco (mês vazio vem zerado)', async () => {
    const { uc } = await setup();
    const r = await uc.execute({ userId: 'u1', month: '2026-11', months: 4 });
    expect(r.months.map((m) => m.month)).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
    expect(r.months[0]).toEqual({ month: '2026-08', incomeInCents: 0, outcomeInCents: 0 });
    expect(r.months[1]).toEqual({ month: '2026-09', incomeInCents: 3000_00, outcomeInCents: 800_00 });
  });

  it('transferência interna não conta (mesma regra do resumo do mês)', async () => {
    const { uc } = await setup();
    const r = await uc.execute({ userId: 'u1', month: '2026-11', months: 3 });
    expect(r.months.find((m) => m.month === '2026-10')).toMatchObject({ outcomeInCents: 500_00 });
  });

  it('cada mês bate com o GetMonthSummary daquele mês (paridade)', async () => {
    const { repos, uc } = await setup();
    const summary = new GetMonthSummaryUseCase(repos, () => NOW);
    const r = await uc.execute({ userId: 'u1', month: '2026-11', months: 6 });
    for (const m of r.months) {
      const s = await summary.execute({ userId: 'u1', month: m.month });
      expect({ i: m.incomeInCents, o: m.outcomeInCents }).toEqual({ i: s.incomeInCents, o: s.outcomeInCents });
    }
  });

  it('atravessa a virada do ano', async () => {
    const { uc } = await setup();
    const r = await uc.execute({ userId: 'u1', month: '2027-02', months: 4 });
    expect(r.months.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('só vê os lançamentos da própria pessoa', async () => {
    const { uc } = await setup();
    const r = await uc.execute({ userId: 'outra', month: '2026-11', months: 3 });
    expect(r.months.every((m) => m.incomeInCents === 0 && m.outcomeInCents === 0)).toBe(true);
  });
});

describe('GET /summary/history (HTTP)', () => {
  async function client() {
    const app = await buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'h@x.com', password: '12345678', acceptedTerms: true },
    });
    return { app, auth: { authorization: `Bearer ${reg.json().accessToken}` } };
  }

  it('exige login', async () => {
    const { app } = await client();
    expect((await app.inject({ method: 'GET', url: '/summary/history?month=2026-11' })).statusCode).toBe(401);
  });

  it('padrão é 6 meses; aceita de 2 a 12; fora disso (ou mês inválido) é 400', async () => {
    const { app, auth } = await client();
    const ok = await app.inject({ method: 'GET', url: '/summary/history?month=2026-11', headers: auth });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().months).toHaveLength(6);
    for (const q of ['months=1', 'months=13', 'months=abc']) {
      const r = await app.inject({ method: 'GET', url: `/summary/history?month=2026-11&${q}`, headers: auth });
      expect(r.statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'GET', url: '/summary/history?month=2026-13', headers: auth })).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject({ method: 'GET', url: '/summary/history?month=2026-11&months=12', headers: auth })).json()
        .months,
    ).toHaveLength(12);
  });
});
