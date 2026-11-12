import { describe, expect, it } from 'vitest';
import type { FinancialPlan } from '@tostao/contracts';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ForecastUseCase, SaveFinancialPlanUseCase, SuggestIncomeUseCase } from './financial-plan.js';

const NOW = new Date('2026-11-12T12:00:00Z');

function setup() {
  const repos = makeInMemoryRepositories();
  const add = (description: string, amountInCents: number, date: string, accountId = 'a1') =>
    repos.transactions.create({ userId: 'u1', accountId, externalId: null, description, amountInCents, occurredAt: new Date(`${date}T12:00:00Z`), categoryId: null, isInternalTransfer: false });
  return { repos, add };
}

const plan = (over: Partial<FinancialPlan> = {}): FinancialPlan => ({
  salary: { amountInCents: 320000, payday: 5, varies: true, bank: 'Bradesco', advance: { day: 15, amountInCents: 160000 }, pattern: 'TRANSF SALDO C/SAL P/CC - BCO 237' },
  otherIncomes: [{ name: 'Pix da família', amountInCents: 550000, day: 2, countsAsIncome: false, pattern: 'TRANSF.AUTORIZ.ENTRE C/C - FULANO' }],
  fixedExpenses: [{ name: 'Aluguel', amountInCents: 90000, day: 10 }],
  goal: null,
  benefits: [{ kind: 'VR', amountInCents: 60000, day: 1 }],
  ...over,
});

describe('Renda e previsão', () => {
  it('sugere as entradas que se repetem, agrupando o salário que vem em partes', async () => {
    const { repos, add } = setup();
    await add('TRANSF SALDO C/SAL P/CC - BCO 237 AGE 03301 CTA 0012', 125055, '2026-10-01');
    await add('TRANSF SALDO C/SAL P/CC - BCO 237 AGE 03301 CTA 0012', 100000, '2026-10-16');
    await add('TRANSF SALDO C/SAL P/CC - BCO 237 AGE 03301 CTA 0012', 370180, '2026-09-11');
    await add('PIX RECEBIDO AMIGO', 2000, '2026-10-20');
    const { suggestions } = await new SuggestIncomeUseCase(repos, () => NOW).execute({ userId: 'u1' });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.months).toBe(2);
    expect(suggestions[0]!.monthlyAvgInCents).toBe(Math.round((125055 + 100000 + 370180) / 2));
  });

  it('"só repasso" vira Não conta (sai da renda) e o salário vai pra Salário e renda', async () => {
    const { repos, add } = setup();
    const pix = await add('TRANSF.AUTORIZ.ENTRE C/C - FULANO DE TAL', 552969, '2026-10-02');
    const sal = await add('TRANSF SALDO C/SAL P/CC - BCO 237 AGE 03301', 115923, '2026-10-31');
    const r = await new SaveFinancialPlanUseCase(repos, () => NOW).execute({ userId: 'u1', plan: plan() });
    expect(r.updated).toBe(2);
    expect(await repos.transactions.findById(pix.id)).toMatchObject({ categoryId: 'nao-conta', isInternalTransfer: true });
    expect(await repos.transactions.findById(sal.id)).toMatchObject({ categoryId: 'salario', isInternalTransfer: false });
    expect(await repos.plans.get('u1')).not.toBeNull();
  });

  it('prevê os próximos meses com parcelas que ainda faltam', async () => {
    const { repos, add } = setup();
    await repos.accounts.upsertByExternalId({ userId: 'u1', connectionId: 'c1', externalId: 'card', name: 'Nubank Gold', type: 'CREDIT', balanceInCents: 0, fingerprint: null });
    const card = (await repos.accounts.listByUser('u1'))[0]!.id;
    await add('AMAZON MKTPLACE 9/10', -10000, '2026-11-03', card); // falta 1 parcela (dezembro)
    await add('AMAZON MKTPLACE 8/10', -10000, '2026-10-03', card);
    await new SaveFinancialPlanUseCase(repos, () => NOW).execute({ userId: 'u1', plan: plan() });
    const f = await new ForecastUseCase(repos, () => NOW).execute({ userId: 'u1' });
    expect(f.hasPlan).toBe(true);
    expect(f.months.map((m) => m.month)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(f.months.map((m) => m.installmentsInCents)).toEqual([10000, 0, 0]);
    expect(f.months[0]!.incomeInCents).toBe(320000); // o Pix da família não conta
    expect(f.months[0]!.benefitsInCents).toBe(60000); // VR aparece, mas não soma na sobra
    expect(f.months[1]!.leftInCents).toBe(320000 - 90000 - f.months[1]!.subscriptionsInCents - f.months[1]!.dailyInCents);
  });

  it('sem plano, a previsão avisa que falta a renda', async () => {
    const { repos } = setup();
    expect(await new ForecastUseCase(repos, () => NOW).execute({ userId: 'u1' })).toEqual({ hasPlan: false, months: [] });
  });
});
