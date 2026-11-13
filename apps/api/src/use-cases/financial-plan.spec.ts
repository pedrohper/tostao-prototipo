import { describe, expect, it } from 'vitest';
import type { FinancialPlan } from '@tostao/contracts';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ForecastUseCase, SaveFinancialPlanUseCase, SuggestIncomeUseCase } from './financial-plan.js';
import { CreateManualTransactionUseCase } from './create-manual-transaction.js';
import { DeleteTransactionUseCase } from './delete-transaction.js';

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
    // Nada se repete ainda: valor típico de uma entrada; o acerto de R$ 3.701 não infla a renda.
    expect(suggestions[0]!.monthlyAvgInCents).toBe(125055);
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
    expect(await new ForecastUseCase(repos, () => NOW).execute({ userId: 'u1' })).toEqual({ hasPlan: false, months: [], goal: null, thisMonth: null, base: null });
  });
});

describe('Meta', () => {
  it('calcula quanto guardar por mês até o prazo e se cabe na sobra', async () => {
    const { goalStatus } = await import('./financial-plan.js');
    const g = goalStatus({ kind: 'viagem', label: 'Viagem', amountInCents: 200000, deadline: '2027-07', savedInCents: 40000 }, '2026-11', 30000);
    expect(g.monthsLeft).toBe(8);
    expect(g.monthlyNeededInCents).toBe(20000);
    expect(g.fits).toBe(true);
    expect(g.reached).toBe(false);
    expect(goalStatus({ kind: 'reserva', label: null, amountInCents: 1000, deadline: null, savedInCents: 1000 }, '2026-11', null)).toMatchObject({ label: 'Reserva', reached: true, monthlyNeededInCents: null, fits: null });
  });

  it('"Guardei" soma, "tirei" desconta, e salvar a renda não zera o guardado', async () => {
    const { repos } = setup();
    const { SetGoalUseCase, GoalDepositUseCase } = await import('./financial-plan.js');
    await new SetGoalUseCase(repos).execute({ userId: 'u1', goal: { kind: 'viagem', label: 'Praia', amountInCents: 100000, deadline: '2027-01' } });
    const dep = new GoalDepositUseCase(repos);
    await dep.execute({ userId: 'u1', amountInCents: 5000 });
    expect((await dep.execute({ userId: 'u1', amountInCents: -2000 })).savedInCents).toBe(3000);
    expect((await dep.execute({ userId: 'u1', amountInCents: -9000 })).savedInCents).toBe(0);
    await dep.execute({ userId: 'u1', amountInCents: 7000 });
    await new SaveFinancialPlanUseCase(repos, () => NOW).execute({ userId: 'u1', plan: plan({ goal: { kind: 'viagem', label: 'Praia', amountInCents: 120000, deadline: '2027-01' } }) });
    expect((await repos.plans.get('u1'))!.goal!.savedInCents).toBe(7000);
    const f = await new ForecastUseCase(repos, () => NOW).execute({ userId: 'u1' });
    expect(f.goal!.amountInCents).toBe(120000);
    expect(f.goal!.monthlyNeededInCents).toBe(Math.ceil(113000 / 2));
  });
});

describe('Previsão item por item', () => {
  it('lista parcelas por cartão, o "todo mês" anotado e a fatura prevista', async () => {
    const { repos, add } = setup();
    await repos.accounts.upsertByExternalId({ userId: 'u1', connectionId: 'c1', externalId: 'card', name: 'Nubank Gold', type: 'CREDIT', balanceInCents: 0, fingerprint: null });
    const card = (await repos.accounts.listByUser('u1'))[0]!.id;
    await add('AMAZON MKTPLACE 9/10', -10000, '2026-11-03', card);
    const manual = new CreateManualTransactionUseCase(repos);
    await manual.execute({ userId: 'u1', description: 'Academia', amountInCents: 9990, kind: 'saida', occurredAt: new Date('2026-11-10T15:00:00Z'), repeat: 'mensal' });
    await manual.execute({ userId: 'u1', description: 'Fone', amountInCents: 30000, kind: 'saida', occurredAt: new Date('2026-11-05T15:00:00Z'), accountId: card, repeat: 'parcelado', times: 3 });
    await new SaveFinancialPlanUseCase(repos, () => NOW).execute({ userId: 'u1', plan: plan() });
    const f = await new ForecastUseCase(repos, () => NOW).execute({ userId: 'u1' });
    const dez = f.months[0]!;
    expect(dez.items.find((i) => i.title === 'AMAZON MKTPLACE')).toMatchObject({ kind: 'parcela', detail: '10/10', cardId: card, amountInCents: 10000 });
    expect(dez.items.find((i) => i.title === 'Fone')).toMatchObject({ kind: 'parcela', detail: '2/3', cardId: card, amountInCents: 10000 });
    expect(dez.items.find((i) => i.title === 'Academia')).toMatchObject({ kind: 'anotado', day: 10, cardId: null, amountInCents: 9990 });
    expect(dez.cards).toEqual([{ id: card, name: 'Nubank Gold', dueDay: null, totalInCents: 20000 }]);
    // Fone 3/3 em janeiro; em fevereiro acabou. Academia continua.
    expect(f.months[1]!.items.some((i) => i.title === 'Fone' && i.detail === '3/3')).toBe(true);
    expect(f.months[2]!.items.some((i) => i.title === 'Fone')).toBe(false);
    expect(f.months[2]!.items.some((i) => i.title === 'Academia')).toBe(true);
  });
});

describe('Anotar com repetição', () => {
  it('parcelado divide o total e o resto vai na primeira; dá pra apagar a série dali pra frente', async () => {
    const { repos } = setup();
    const uc = new CreateManualTransactionUseCase(repos);
    const r = await uc.execute({ userId: 'u1', description: 'Celular', amountInCents: 100000, kind: 'saida', occurredAt: new Date('2026-01-31T15:00:00Z'), repeat: 'parcelado', times: 3 });
    expect(r.count).toBe(3);
    const all = repos.transactions.items.filter((t) => t.seriesId === r.transaction.seriesId).sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    expect(all.map((t) => t.amountInCents)).toEqual([-33334, -33333, -33333]);
    expect(all.map((t) => t.description)).toEqual(['Celular (1/3)', 'Celular (2/3)', 'Celular (3/3)']);
    expect(all[1]!.occurredAt.toISOString().slice(0, 10)).toBe('2026-02-28'); // dia 31 vira o último dia de fevereiro
    const del = await new DeleteTransactionUseCase(repos).execute({ userId: 'u1', transactionId: all[1]!.id, series: true });
    expect(del.deleted).toBe(2);
    expect(repos.transactions.items.filter((t) => t.seriesId === r.transaction.seriesId)).toHaveLength(1);
  });

  it('não apaga lançamento do banco', async () => {
    const { repos, add } = setup();
    const t = await repos.transactions.create({ userId: 'u1', accountId: 'a1', externalId: 'x1', description: 'PIX', amountInCents: -100, occurredAt: new Date(), categoryId: null, isInternalTransfer: false });
    void add;
    await expect(new DeleteTransactionUseCase(repos).execute({ userId: 'u1', transactionId: t.id })).rejects.toThrow();
  });
});
