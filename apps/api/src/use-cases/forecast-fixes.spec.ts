// T1.5 · previsão (Forecast): parcelas, adiantamento do salário, dia 31, conta oculta, vencimento de cartão.
import { describe, expect, it } from 'vitest';
import type { FinancialPlan } from '@tostao/contracts';
import type { Transaction } from '../domain/entities.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { ForecastUseCase, installmentsInMonth, installmentsOfMonth, pendingInstallments } from './financial-plan.js';

const brt = (iso: string) => new Date(`${iso}-03:00`);
let n = 0;
const card = new Set(['card']);
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  userId: 'u1',
  accountId: 'card',
  externalId: `e${n}`,
  description: 'X',
  amountInCents: -100_00,
  occurredAt: brt('2026-11-10T12:00:00'),
  categoryId: null,
  isInternalTransfer: false,
  seriesId: null,
  createdAt: new Date(),
  ...o,
});

describe('parcelas do cartão (pendingInstallments)', () => {
  it('9/10 e 10/10 no MESMO mês: a compra acabou, nada é projetado (antes projetava uma 10/10 que já tinha caído)', () => {
    const list = pendingInstallments(
      [
        tx({ description: 'GELADEIRA 9/10', occurredAt: brt('2026-11-03T12:00:00') }),
        tx({ description: 'GELADEIRA 10/10', occurredAt: brt('2026-11-25T12:00:00') }),
      ],
      card,
    );
    expect(list).toEqual([]);
  });

  it('9/10 sozinha ainda projeta a 10/10 do mês seguinte', () => {
    const [p] = pendingInstallments(
      [tx({ description: 'GELADEIRA 9/10', occurredAt: brt('2026-11-03T12:00:00') })],
      card,
    );
    expect(p).toMatchObject({ n: 9, total: 10, month: '2026-11' });
    expect(installmentsOfMonth([p!], '2026-12')).toEqual([expect.objectContaining({ n: 10 })]);
  });

  it('mês ANTERIOR à compra não tem parcela (n < n atual é inválido) e depois do total também não', () => {
    const [p] = pendingInstallments([tx({ description: 'TV 3/6', occurredAt: brt('2026-11-03T12:00:00') })], card);
    expect(installmentsInMonth([p!], '2026-10')).toBe(0);
    expect(installmentsInMonth([p!], '2026-11')).toBe(100_00); // o próprio mês (já caiu)
    expect(installmentsInMonth([p!], '2027-02')).toBe(100_00); // 6/6
    expect(installmentsInMonth([p!], '2027-03')).toBe(0); // acabou
  });

  it('o mês da compra vem do fuso: 31/10 às 22h de Brasília é outubro (não novembro UTC)', () => {
    const [p] = pendingInstallments(
      [tx({ description: 'TV 3/6', occurredAt: brt('2026-10-31T22:00:00') })],
      card,
      'America/Sao_Paulo',
    );
    expect(p!.month).toBe('2026-10');
  });
});

async function setup(plan: Partial<FinancialPlan>, now = brt('2026-11-20T10:00:00')) {
  const repos = makeInMemoryRepositories();
  await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: null });
  const user = (await repos.users.listAllIds())[0]!;
  const conn = await repos.connections.create({ userId: user, itemId: 'item-1', institution: 'Banco' });
  const mkAcc = (externalId: string, type: 'BANK' | 'CREDIT', extra: object = {}) =>
    repos.accounts.upsertByExternalId({
      userId: user,
      connectionId: conn.id,
      externalId,
      name: externalId,
      type,
      balanceInCents: 0,
      fingerprint: null,
      ...extra,
    });
  await repos.plans.save(user, {
    salary: null,
    otherIncomes: [],
    fixedExpenses: [],
    benefits: [],
    goal: null,
    ...plan,
  } as FinancialPlan);
  return { repos, user, mkAcc, forecast: new ForecastUseCase(repos, () => now) };
}

describe('Forecast', () => {
  it('adiantamento do salário vira dois lançamentos (adiantamento + resto) e a renda total do mês não muda', async () => {
    const { forecast, user } = await setup({
      salary: {
        amountInCents: 3000_00,
        payday: 5,
        varies: false,
        bank: null,
        advance: { day: 20, amountInCents: 1200_00 },
        pattern: null,
      },
    });
    const month = (await forecast.execute({ userId: user })).months[0]!;
    const rendas = month.items.filter((i) => i.kind === 'renda');
    expect(rendas.map((r) => [r.title, r.amountInCents, r.day])).toEqual([
      ['Salário', 1800_00, 5],
      ['Adiantamento do salário', 1200_00, 20],
    ]);
    expect(rendas.reduce((s, r) => s + r.amountInCents, 0)).toBe(3000_00);
    expect(month.incomeInCents).toBe(3000_00);
  });

  it('sem adiantamento, o salário segue inteiro num item só', async () => {
    const { forecast, user } = await setup({
      salary: { amountInCents: 3000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
    });
    const rendas = (await forecast.execute({ userId: user })).months[0]!.items.filter((i) => i.kind === 'renda');
    expect(rendas.map((r) => [r.title, r.amountInCents])).toEqual([['Salário', 3000_00]]);
  });

  it('conta do dia 31 num mês de 30 dias vence no dia 30: no dia 30 ela já não "falta"; no dia 29 ainda falta', async () => {
    const plan = {
      salary: { amountInCents: 3000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
      fixedExpenses: [{ name: 'Aluguel', amountInCents: 900_00, day: 31 }],
    };
    const day29 = await setup(plan, brt('2026-11-29T10:00:00'));
    expect((await day29.forecast.execute({ userId: day29.user })).thisMonth!.fixedLeftInCents).toBe(900_00);
    const day30 = await setup(plan, brt('2026-11-30T10:00:00'));
    expect((await day30.forecast.execute({ userId: day30.user })).thisMonth!.fixedLeftInCents).toBe(0);
  });

  it('lançamento futuro de conta OCULTA não entra na previsão; da conta visível entra', async () => {
    const { forecast, user, repos, mkAcc } = await setup({
      salary: { amountInCents: 3000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
    });
    const visible = await mkAcc('visivel', 'BANK');
    const hidden = await mkAcc('oculta', 'BANK');
    await repos.accounts.setHidden(hidden.id, true);
    const base = {
      userId: user,
      externalId: null,
      categoryId: null,
      isInternalTransfer: false,
      seriesId: null,
      occurredAt: brt('2026-12-10T12:00:00'),
    };
    await repos.transactions.create({
      ...base,
      accountId: visible.id,
      description: 'Parcela visível',
      amountInCents: -111_00,
    });
    await repos.transactions.create({
      ...base,
      accountId: hidden.id,
      description: 'Parcela oculta',
      amountInCents: -222_00,
    });
    const items = (await forecast.execute({ userId: user })).months.find((m) => m.month === '2026-12')!.items;
    expect(items.map((i) => i.title)).toContain('Parcela visível');
    expect(items.map((i) => i.title)).not.toContain('Parcela oculta');
  });

  it('o dia de vencimento do cartão é o da data de calendário (10), não o 9 do desconto de fuso', async () => {
    const { forecast, user, repos, mkAcc } = await setup({
      salary: { amountInCents: 3000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
    });
    const cartao = await mkAcc('cartao', 'CREDIT', { dueDate: new Date('2026-12-10T00:00:00Z') });
    await repos.transactions.create({
      userId: user,
      accountId: cartao.id,
      externalId: null,
      description: 'Compra futura',
      amountInCents: -300_00,
      occurredAt: brt('2026-12-12T12:00:00'),
      categoryId: null,
      isInternalTransfer: false,
      seriesId: null,
    });
    const cards = (await forecast.execute({ userId: user })).months.find((m) => m.month === '2026-12')!.cards;
    expect(cards.map((c) => c.dueDay)).toEqual([10]);
  });

  it('usa o relógio injetado: o mesmo "agora" dá a mesma resposta em duas chamadas', async () => {
    const { forecast, user } = await setup({
      salary: { amountInCents: 3000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
    });
    expect(JSON.stringify(await forecast.execute({ userId: user }))).toBe(
      JSON.stringify(await forecast.execute({ userId: user })),
    );
  });
});
