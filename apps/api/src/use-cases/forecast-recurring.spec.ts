// T5.2 · a previsão lê as regras de lançamento automático (recurring_rules) pros próximos meses.
import { describe, expect, it } from 'vitest';
import type { FinancialPlan } from '@tostao/contracts';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { dueAt } from '../services/recurrence.js';
import { ForecastUseCase } from './financial-plan.js';
import { RecurringRulesUseCase } from './recurring-rules.js';

const brt = (iso: string) => new Date(`${iso}-03:00`);
const NOW = brt('2026-11-20T10:00:00');

async function setup() {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: null });
  await repos.plans.save(user.id, {
    salary: { amountInCents: 3000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
    otherIncomes: [],
    fixedExpenses: [],
    benefits: [],
    goal: null,
  } as FinancialPlan);
  return {
    repos,
    user: user.id,
    rules: new RecurringRulesUseCase(repos, () => NOW),
    forecast: new ForecastUseCase(repos, () => NOW),
  };
}
const rule = (over: Record<string, unknown> = {}) => ({
  description: 'Aluguel',
  amountInCents: 1500_00,
  kind: 'saida' as const,
  frequency: 'MONTHLY' as const,
  startDate: '2026-12-05',
  accountId: null,
  autoPost: true,
  ...over,
});

describe('previsão com regras automáticas', () => {
  it('uma conta mensal aparece em CADA mês previsto, no dia dela, e entra no total do que sai', async () => {
    const { rules, forecast, user } = await setup();
    await rules.create(user, rule());
    const months = (await forecast.execute({ userId: user })).months;
    expect(months.map((m) => m.month)).toEqual(['2026-12', '2027-01', '2027-02']);
    for (const m of months) {
      const item = m.items.find((i) => i.title === 'Aluguel')!;
      expect(item).toMatchObject({ amountInCents: 1500_00, entrada: false, day: 5 });
      expect(m.scheduledOutInCents).toBeGreaterThanOrEqual(1500_00);
    }
  });

  it('parcelado: mostra n/total, para quando acaba e conta como parcela', async () => {
    const { rules, forecast, user } = await setup();
    await rules.create(user, rule({ description: 'Notebook', amountInCents: 400_00, totalInstallments: 2 }));
    const months = (await forecast.execute({ userId: user })).months;
    expect(months[0]!.items.find((i) => i.title === 'Notebook')).toMatchObject({ kind: 'parcela', detail: '1/2' });
    expect(months[1]!.items.find((i) => i.title === 'Notebook')).toMatchObject({ kind: 'parcela', detail: '2/2' });
    expect(months[2]!.items.find((i) => i.title === 'Notebook')).toBeUndefined(); // acabou
  });

  it('salário (entrada) entra como renda do mês', async () => {
    const { rules, forecast, user } = await setup();
    await rules.create(user, rule({ description: 'Freela fixo', kind: 'entrada', amountInCents: 900_00 }));
    const m = (await forecast.execute({ userId: user })).months[0]!;
    expect(m.items.find((i) => i.title === 'Freela fixo')).toMatchObject({ entrada: true, amountInCents: 900_00 });
    expect(m.scheduledInInCents).toBe(900_00);
  });

  it('regra pausada, ou só com autoPost=false (sem lançar sozinha) — pausada some; autoPost=false AINDA aparece na previsão', async () => {
    const { rules, forecast, user, repos } = await setup();
    const a = await rules.create(user, rule({ description: 'Pausada' }));
    await rules.update(user, a.rule.id, { active: false });
    await rules.create(user, rule({ description: 'Só previsão', autoPost: false }));
    const titles = (await forecast.execute({ userId: user })).months[0]!.items.map((i) => i.title);
    expect(titles).not.toContain('Pausada');
    expect(titles).toContain('Só previsão');
    void repos;
  });

  it('não conta em dobro: se o mês já tem o lançamento real da regra, o projetado sai', async () => {
    const { rules, forecast, user, repos } = await setup();
    const { rule: r } = await rules.create(user, rule());
    await repos.transactions.create({
      userId: user,
      accountId: null,
      externalId: `rec:${r.id}:2026-12`,
      description: 'Aluguel',
      amountInCents: -1500_00,
      occurredAt: dueAt('2026-12-05', 'America/Sao_Paulo'),
      categoryId: null,
      isInternalTransfer: false,
    });
    const dec = (await forecast.execute({ userId: user })).months[0]!;
    expect(dec.items.filter((i) => i.title === 'Aluguel')).toHaveLength(1);
  });

  it('regra de outra pessoa nunca aparece na previsão', async () => {
    const { rules, forecast, user, repos } = await setup();
    const other = await repos.users.create({ name: 'Bia', email: 'b@x.com', passwordHash: null });
    await rules.create(other.id, rule({ description: 'Da Bia' }));
    const m = (await forecast.execute({ userId: user })).months[0]!;
    expect(m.items.map((i) => i.title)).not.toContain('Da Bia');
  });

  it('semanal: aparece uma vez por semana dentro do mês', async () => {
    const { rules, forecast, user } = await setup();
    await rules.create(
      user,
      rule({ description: 'Feira', amountInCents: 50_00, frequency: 'WEEKLY', startDate: '2026-12-04' }),
    );
    const dec = (await forecast.execute({ userId: user })).months[0]!;
    expect(dec.items.filter((i) => i.title === 'Feira').map((i) => i.day)).toEqual([4, 11, 18, 25]);
  });
});
