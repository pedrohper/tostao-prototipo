// T6.17 · "quanto posso gastar hoje" pela previsão de verdade (use-cases com repositório em memória). Horários em Brasília.
import { describe, expect, it } from 'vitest';
import type { FinancialPlan, Goal } from '@tostao/contracts';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ForecastUseCase, GoalDepositUseCase, SaveFinancialPlanUseCase, SetGoalUseCase } from './financial-plan.js';
import { RecurringRulesUseCase } from './recurring-rules.js';

const brt = (iso: string) => new Date(`${iso}-03:00`);
/** 16/11 de manhã: novembro tem 30 dias, então faltam 15 contando hoje. */
const MID_MONTH = brt('2026-11-16T10:00:00');

type Fixed = FinancialPlan['fixedExpenses'][number];
type Over = { salary?: number; fixed?: Fixed[]; goal?: Goal | null; now?: Date };

async function setup({ salary = 3000_00, fixed = [], goal = null, now = MID_MONTH }: Over = {}) {
  const repos = makeInMemoryRepositories();
  const { id: userId } = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: null });
  await repos.plans.save(userId, {
    salary: salary
      ? { amountInCents: salary, payday: 5, varies: false, bank: null, advance: null, pattern: null }
      : null,
    otherIncomes: [],
    fixedExpenses: fixed,
    benefits: [],
    goal,
  });
  const card = await repos.accounts.upsertByExternalId({
    userId,
    connectionId: 'conexao',
    externalId: 'cartao',
    name: 'Cartão',
    type: 'CREDIT',
    balanceInCents: 0,
    fingerprint: null,
  });
  let n = 0;
  const spend = (day: string, cents: number, description = 'MERCADO', accountId: string | null = null) =>
    repos.transactions.create({
      userId,
      accountId,
      externalId: `t-${n++}`,
      description,
      amountInCents: -cents,
      occurredAt: brt(`${day}T12:00:00`),
      categoryId: null,
      isInternalTransfer: false,
    });
  const read = async (at: Date = now) => {
    const { thisMonth } = await new ForecastUseCase(repos, () => at).execute({ userId });
    return thisMonth;
  };
  const breakdown = async (at?: Date) => (await read(at))!.safeToSpend!;
  return { repos, userId, card, spend, read, breakdown, now };
}

const trip = (over: Partial<Goal> = {}): Goal => ({
  id: 'viagem',
  kind: 'viagem',
  label: 'Praia',
  amountInCents: 1200_00,
  savedInCents: 0,
  deadline: '2027-03', // 4 meses depois de novembro: R$ 300 por mês
  ...over,
});

describe('a conta do "posso gastar hoje"', () => {
  it('meio do mês: renda − gasto − fixos − assinaturas − meta, dividido pelos dias que faltam contando hoje', async () => {
    const { spend, read } = await setup({
      fixed: [{ name: 'Aluguel', amountInCents: 900_00, day: 20 }],
      goal: trip(),
    });
    await spend('2026-11-03', 400_00);
    for (const day of ['2026-08-22', '2026-09-22', '2026-10-22']) await spend(day, 55_00, 'NETFLIX.COM');

    const month = (await read())!;
    // 3000 − 400 − 900 − 55 − 300 = 1345,00 em 15 dias = 89,66 por dia (arredondado pra baixo)
    expect(month.safeToSpend).toEqual({
      availableInCents: 1345_00,
      daysIncludingToday: 15,
      fixedInCents: 900_00,
      subscriptionsInCents: 55_00,
      scheduledInCents: 0,
      goalInCents: 300_00,
    });
    expect(month.safeToSpendTodayInCents).toBe(89_66);
    // Não é o ritmo em que a pessoa vem gastando.
    expect(month.safeToSpendTodayInCents).not.toBe(month.dailyPaceInCents);
  });

  it('último dia do mês: sobra um dia (hoje) e ele recebe tudo', async () => {
    const { spend, read } = await setup({ now: brt('2026-11-30T20:00:00') });
    await spend('2026-11-10', 2500_00);
    const month = (await read())!;
    expect(month.daysLeft).toBe(0);
    expect(month.safeToSpend!.daysIncludingToday).toBe(1);
    expect(month.safeToSpendTodayInCents).toBe(500_00);
  });

  it('sem meta e sem contas: só renda menos o que já saiu', async () => {
    const { spend, read } = await setup();
    await spend('2026-11-02', 1500_00);
    const month = (await read())!;
    expect(month.safeToSpend!.goalInCents).toBe(0);
    expect(month.safeToSpendTodayInCents).toBe(100_00);
  });

  it('negativo: o que falta sair passa da renda (e o arredondamento não ajuda)', async () => {
    const { spend, read } = await setup({ fixed: [{ name: 'Aluguel', amountInCents: 900_00, day: 25 }] });
    await spend('2026-11-02', 2200_00);
    const month = (await read())!;
    expect(month.safeToSpend!.availableInCents).toBe(-100_00);
    expect(month.safeToSpendTodayInCents).toBe(-6_67); // −100 / 15 = −6,666…
  });

  it('sem renda cadastrada: não há número nenhum', async () => {
    const { spend, read } = await setup({ salary: 0, fixed: [{ name: 'Aluguel', amountInCents: 900_00, day: 25 }] });
    await spend('2026-11-02', 100_00);
    expect(await read()).toBeNull();
  });

  it('o dia é o de São Paulo: 22h do dia 30 em Brasília ainda é novembro, mesmo já sendo dezembro em UTC', async () => {
    const { spend, read } = await setup();
    await spend('2026-11-10', 2900_00);
    const lastNight = (await read(new Date('2026-12-01T01:00:00Z')))!;
    expect(lastNight.month).toBe('2026-11');
    expect(lastNight.safeToSpendTodayInCents).toBe(100_00);
    // Três horas depois virou o mês pra pessoa: 31 dias e nada gasto.
    const newMonth = (await read(new Date('2026-12-01T04:00:00Z')))!;
    expect(newMonth.month).toBe('2026-12');
    expect(newMonth.safeToSpend!.daysIncludingToday).toBe(31);
    expect(newMonth.safeToSpendTodayInCents).toBe(96_77);
  });

  it('entrou mais do que a renda informada: vale o que entrou', async () => {
    const { repos, userId, read } = await setup();
    await repos.transactions.create({
      userId,
      accountId: null,
      externalId: 'extra',
      description: 'FREELA',
      amountInCents: 3300_00,
      occurredAt: brt('2026-11-04T12:00:00'),
      categoryId: null,
      isInternalTransfer: false,
    });
    expect((await read())!.safeToSpend!.availableInCents).toBe(3300_00);
  });
});

describe('nada é descontado duas vezes', () => {
  const netflix = async (spend: Awaited<ReturnType<typeof setup>>['spend'], days: string[]) => {
    for (const day of days) await spend(day, 55_00, 'NETFLIX.COM');
  };

  it('assinatura que também está nas contas fixas conta uma vez (o maior valor)', async () => {
    const { spend, breakdown } = await setup({ fixed: [{ name: 'Netflix', amountInCents: 59_90, day: 22 }] });
    await netflix(spend, ['2026-08-22', '2026-09-22', '2026-10-22']);
    const b = await breakdown();
    expect([b.fixedInCents, b.subscriptionsInCents]).toEqual([59_90, 0]);
    expect(b.availableInCents).toBe(3000_00 - 59_90);
  });

  it('assinatura que já cobrou neste mês não é cobrada de novo, mesmo com a próxima "prevista" pro fim do mês', async () => {
    const { spend, breakdown } = await setup({ now: brt('2026-12-02T10:00:00') });
    await netflix(spend, ['2026-10-01', '2026-11-01', '2026-12-01']); // próxima estimada: 31/12
    const b = await breakdown();
    expect(b.subscriptionsInCents).toBe(0);
    expect(b.availableInCents).toBe(3000_00 - 55_00);
  });

  it('assinatura atrasada há poucos dias ainda vai cair', async () => {
    const { spend, breakdown } = await setup();
    await netflix(spend, ['2026-08-14', '2026-09-14', '2026-10-14']); // esperada em 14/11, hoje é 16
    expect((await breakdown()).subscriptionsInCents).toBe(55_00);
  });

  it('conta fixa paga antes do vencimento (mesmo nome) sai do "falta"', async () => {
    const { spend, breakdown } = await setup({ fixed: [{ name: 'Academia', amountInCents: 100_00, day: 28 }] });
    await spend('2026-11-10', 99_90, 'ACADEMIA CORPO EM FORMA');
    const b = await breakdown();
    expect(b.fixedInCents).toBe(0);
    expect(b.availableInCents).toBe(3000_00 - 99_90);
  });

  it('a previsão do mês também não desconta de novo a conta fixa já anotada', async () => {
    const { spend, read } = await setup({ fixed: [{ name: 'Conta de luz', amountInCents: 86_00, day: 28 }] });
    const before = (await read())!;
    expect(before.fixedLeftInCents).toBe(86_00);
    await spend('2026-11-28', 86_00, 'Luz');
    const after = (await read())!;
    expect(after.fixedLeftInCents).toBe(0);
    expect(after.spentInCents).toBe(86_00);
    // anotar não muda o quanto sobra: a conta só trocou de lugar
    expect(after.leftInCents).toBe(before.leftInCents);
  });

  it('Pix sem o nome da conta, de valor idêntico e perto do vencimento, paga a conta grande', async () => {
    const { spend, breakdown } = await setup({ fixed: [{ name: 'Aluguel', amountInCents: 1200_00, day: 18 }] });
    await spend('2026-11-15', 1200_00, 'PIX ENVIADO JOAO SILVA');
    expect((await breakdown()).fixedInCents).toBe(0);
  });

  it('valor pequeno igual, ou grande longe do vencimento, NÃO prova pagamento', async () => {
    const { spend, breakdown } = await setup({
      fixed: [
        { name: 'Internet', amountInCents: 100_00, day: 18 },
        { name: 'Aluguel', amountInCents: 1200_00, day: 28 },
      ],
    });
    await spend('2026-11-15', 100_00, 'PIX ENVIADO MARIA');
    await spend('2026-11-02', 1200_00, 'PIX ENVIADO JOAO SILVA');
    expect((await breakdown()).fixedInCents).toBe(1300_00);
  });

  it('conta fixa de hoje ainda não paga é descontada; a de dia que passou conta como paga', async () => {
    const { breakdown } = await setup({
      fixed: [
        { name: 'Luz', amountInCents: 150_00, day: 16 },
        { name: 'Faculdade', amountInCents: 700_00, day: 10 },
        { name: 'Condomínio', amountInCents: 300_00, day: 31 }, // novembro: vence dia 30
      ],
    });
    expect((await breakdown()).fixedInCents).toBe(450_00);
  });

  it('parcela de compra antiga que ainda não caiu é descontada; depois que cai, só está no "já gasto"', async () => {
    const { spend, breakdown, card } = await setup();
    await spend('2026-10-20', 200_00, 'LOJA TECH 2/6', card.id);
    const pending = await breakdown();
    expect([pending.scheduledInCents, pending.availableInCents]).toEqual([200_00, 2800_00]);

    await spend('2026-11-14', 200_00, 'LOJA TECH 3/6', card.id);
    const posted = await breakdown();
    expect([posted.scheduledInCents, posted.availableInCents]).toEqual([0, 2800_00]);
  });

  it('parcela já lançada com data mais pra frente neste mês não é descontada de novo', async () => {
    const { spend, breakdown, card } = await setup();
    await spend('2026-10-28', 200_00, 'LOJA TECH 2/6', card.id);
    await spend('2026-11-28', 200_00, 'LOJA TECH 3/6', card.id);
    const b = await breakdown();
    expect([b.scheduledInCents, b.availableInCents]).toEqual([0, 2800_00]);
  });

  it('lançamento automático que ainda vai cair é descontado uma vez, mesmo repetindo uma conta fixa', async () => {
    const { repos, userId, breakdown } = await setup({
      fixed: [{ name: 'Aluguel', amountInCents: 900_00, day: 25 }],
    });
    const rules = new RecurringRulesUseCase(repos, () => MID_MONTH);
    const base = { kind: 'saida' as const, frequency: 'MONTHLY' as const, accountId: null, autoPost: true };
    await rules.create(userId, { ...base, description: 'Aluguel', amountInCents: 900_00, startDate: '2026-11-25' });
    await rules.create(userId, { ...base, description: 'Curso', amountInCents: 120_00, startDate: '2026-11-27' });
    await rules.create(userId, {
      ...base,
      description: 'Só em dezembro',
      amountInCents: 80_00,
      startDate: '2026-12-02',
    });
    const b = await breakdown();
    expect([b.fixedInCents, b.scheduledInCents]).toEqual([900_00, 120_00]);
  });

  it('receita automática e regra pausada não descontam', async () => {
    const { repos, userId, breakdown } = await setup();
    const rules = new RecurringRulesUseCase(repos, () => MID_MONTH);
    const base = { frequency: 'MONTHLY' as const, accountId: null, autoPost: true, startDate: '2026-11-25' };
    await rules.create(userId, { ...base, kind: 'entrada', description: 'Freela', amountInCents: 500_00 });
    const paused = await rules.create(userId, { ...base, kind: 'saida', description: 'Pausada', amountInCents: 70_00 });
    await rules.update(userId, paused.rule.id, { active: false });
    expect((await breakdown()).availableInCents).toBe(3000_00);
  });
});

describe('meta no mês', () => {
  const deposit = async (ctx: Awaited<ReturnType<typeof setup>>, cents: number, at = MID_MONTH) =>
    new GoalDepositUseCase(ctx.repos, () => at).execute({ userId: ctx.userId, goalId: 'viagem', amountInCents: cents });

  it('"Guardei" uma parte não muda o número: o mês continua reservando o mesmo valor', async () => {
    const ctx = await setup({ goal: trip() });
    expect((await ctx.breakdown()).goalInCents).toBe(300_00);
    await deposit(ctx, 100_00);
    expect((await ctx.breakdown()).goalInCents).toBe(300_00);
    await deposit(ctx, 200_00);
    expect((await ctx.breakdown()).goalInCents).toBe(300_00);
  });

  it('guardou mais que o mensal: o mês reserva o que foi guardado; tirou de volta: volta ao mensal', async () => {
    const ctx = await setup({ goal: trip() });
    await deposit(ctx, 500_00);
    expect((await ctx.breakdown()).goalInCents).toBe(500_00);
    await deposit(ctx, -500_00);
    expect((await ctx.breakdown()).goalInCents).toBe(300_00);
  });

  it('o depósito vale só no mês em que foi feito (fuso da pessoa)', async () => {
    const ctx = await setup({ goal: trip() });
    await deposit(ctx, 300_00, new Date('2026-12-01T01:00:00Z')); // 30/11 às 22h em Brasília
    expect((await ctx.breakdown()).goalInCents).toBe(300_00);
    // Em dezembro sobram 900 em 3 meses: 300 de novo.
    expect((await ctx.breakdown(brt('2026-12-10T10:00:00'))).goalInCents).toBe(300_00);
  });

  it('várias metas somam; meta sem prazo só conta o que foi separado', async () => {
    const ctx = await setup({ goal: trip() });
    const goals = new SetGoalUseCase(ctx.repos);
    await goals.add({ userId: ctx.userId, goal: { ...trip(), id: 'reserva', kind: 'reserva', deadline: null } });
    expect((await ctx.breakdown()).goalInCents).toBe(300_00);
    await new GoalDepositUseCase(ctx.repos, () => MID_MONTH).execute({
      userId: ctx.userId,
      goalId: 'reserva',
      amountInCents: 50_00,
    });
    expect((await ctx.breakdown()).goalInCents).toBe(350_00);
  });

  it('editar a meta ou salvar a renda não esquece o que foi guardado no mês', async () => {
    const ctx = await setup({ goal: trip() });
    await deposit(ctx, 500_00);
    const goals = new SetGoalUseCase(ctx.repos);
    const { savedInCents: _, ...edit } = trip({ label: 'Serra' });
    await goals.update({ userId: ctx.userId, id: 'viagem', goal: edit });
    await goals.execute({ userId: ctx.userId, goal: edit });
    const plan = (await ctx.repos.plans.get(ctx.userId))!;
    await new SaveFinancialPlanUseCase(ctx.repos).execute({ userId: ctx.userId, plan: { ...plan, goals: [edit] } });
    await new SaveFinancialPlanUseCase(ctx.repos).execute({
      userId: ctx.userId,
      plan: { ...plan, goals: undefined, goal: edit },
    });
    expect((await ctx.breakdown()).goalInCents).toBe(500_00);
  });
});
