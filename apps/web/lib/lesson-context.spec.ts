import { describe, expect, it } from 'vitest';
import type { FinancialPlan, MonthSummaryResponse, SubscriptionsResponse } from '@tostao/contracts';
import {
  bisturiItems,
  buildLessonContext,
  fatiasPreset,
  personalizeHook,
  planIncomeCents,
  raloPreset,
  termometroPreset,
  type LessonUserContext,
} from './lesson-context';

/** `money()` usa espaço não-quebrável depois do R$: nos testes comparamos com espaço normal. */
const plain = (s: string) => s.replace(/\u00a0/g, ' ');

const summary = (over: Partial<MonthSummaryResponse> = {}): MonthSummaryResponse => ({
  month: '2026-11',
  balanceInCents: 250_000,
  incomeInCents: 200_000,
  outcomeInCents: 150_000,
  uncategorizedCount: 0,
  byCategory: [
    { categoryId: 'mercado', name: 'Mercado', color: '#0f0', totalInCents: 50_000 },
    { categoryId: 'delivery', name: 'Delivery', color: '#f00', totalInCents: 31_240 },
    { categoryId: 'casa', name: 'Casa e contas', color: '#00f', totalInCents: 40_000 },
    { categoryId: 'role', name: 'Rolê', color: '#ff0', totalInCents: 20_000 },
    { categoryId: null, name: 'Sem categoria', color: '#000', totalInCents: 8_760 },
  ],
  accounts: [],
  hiddenAccounts: [],
  ...over,
});
const subs = (): SubscriptionsResponse => ({
  subscriptions: [
    {
      key: 'netflix',
      name: 'Netflix',
      amountInCents: 5_590,
      chargeCount: 6,
      lastChargedAt: '2026-11-05',
      nextChargeAt: '2026-12-05',
      active: true,
      installmentsLeft: null,
      duplicateOf: null,
    },
    {
      key: 'spotify',
      name: 'Spotify',
      amountInCents: 2_190,
      chargeCount: 6,
      lastChargedAt: '2026-11-07',
      nextChargeAt: '2026-12-07',
      active: true,
      installmentsLeft: null,
      duplicateOf: null,
    },
    {
      key: 'velho',
      name: 'Velho',
      amountInCents: 9_900,
      chargeCount: 2,
      lastChargedAt: '2026-05-07',
      nextChargeAt: '2026-06-07',
      active: false,
      installmentsLeft: null,
      duplicateOf: null,
    },
  ],
  ignored: [],
  monthlyInCents: 7_780,
  yearlyInCents: 93_360,
});
const plan = (salary: number | null, extras: number[] = []): FinancialPlan => ({
  salary: salary ? { amountInCents: salary, payday: 5, varies: false, bank: null, advance: null, pattern: null } : null,
  otherIncomes: extras.map((amountInCents, i) => ({
    name: `x${i}`,
    amountInCents,
    day: null,
    countsAsIncome: i % 2 === 0,
    pattern: null,
  })),
  fixedExpenses: [],
  benefits: [],
  goal: null,
});
const ctxOf = (over: Partial<Parameters<typeof buildLessonContext>[0]> = {}) =>
  buildLessonContext({
    month: '2026-11',
    currentMonth: '2026-11',
    summary: summary(),
    plan: null,
    subscriptions: subs(),
    ...over,
  });

describe('buildLessonContext', () => {
  it('monta renda do extrato, gasto, maior categoria (sem "Sem categoria"), delivery e necessidades x desejos', () => {
    const c = ctxOf()!;
    expect(c).toMatchObject({
      incomeCents: 200_000,
      incomeSource: 'extrato',
      spentCents: 150_000,
      deliveryCents: 31_240,
      needsCents: 90_000, // mercado + casa
      wantsCents: 51_240, // delivery + rolê
      balanceCents: 250_000,
      isCurrentMonth: true,
    });
    expect(c.topCategory).toEqual({ name: 'Mercado', totalCents: 50_000 });
  });

  it('só assinaturas ATIVAS, as maiores primeiro, até 6', () => {
    const c = ctxOf()!;
    expect(c.subscriptions.map((s) => s.name)).toEqual(['Netflix', 'Spotify']);
    expect(c.subscriptionsMonthlyCents).toBe(7_780);
  });

  it('sem entrada no extrato usa a renda contada no plano (só o que conta como renda)', () => {
    expect(planIncomeCents(plan(300_000, [50_000, 10_000]))).toBe(350_000); // o 2º "extra" não conta como renda
    const c = ctxOf({ summary: summary({ incomeInCents: 0 }), plan: plan(300_000) })!;
    expect(c).toMatchObject({ incomeCents: 300_000, incomeSource: 'plano' });
  });

  it('conta nova (sem extrato, plano, assinaturas nem saldo): null, e a lição segue didática', () => {
    expect(
      buildLessonContext({
        month: '2026-11',
        currentMonth: '2026-11',
        summary: summary({ incomeInCents: 0, outcomeInCents: 0, byCategory: [], balanceInCents: null }),
        plan: null,
        subscriptions: { subscriptions: [], ignored: [], monthlyInCents: 0, yearlyInCents: 0 },
      }),
    ).toBeNull();
    expect(
      buildLessonContext({ month: '2026-11', currentMonth: '2026-11', summary: null, plan: null, subscriptions: null }),
    ).toBeNull();
  });

  it('API de resumo fora (null) mas com assinaturas: ainda dá contexto parcial', () => {
    const c = ctxOf({ summary: null })!;
    expect(c.spentCents).toBe(0);
    expect(c.subscriptions).toHaveLength(2);
  });
});

describe('personalizeHook', () => {
  const FALLBACK = 'Entrou R$ 1.307,90 e no dia 15 restavam R$ 120.';
  const c = ctxOf()!;

  it('M1-L1 com extrato: números reais da pessoa, mês e maior ralo', () => {
    const h = personalizeHook('m1-l1', c, FALLBACK);
    expect(h.personalized).toBe(true);
    expect(plain(h.text)).toContain('Entrou R$ 2.000,00 e saiu R$ 1.500,00 em novembro (até agora)');
    expect(plain(h.text)).toContain('O maior ralo: Mercado, R$ 500,00');
    expect(h.text).not.toContain('1.307,90');
  });

  it('M1-L1 sem entrada no extrato mas com plano: usa "você contou que ganha"', () => {
    const cp = ctxOf({ summary: summary({ incomeInCents: 0 }), plan: plan(300_000) })!;
    expect(plain(personalizeHook('m1-l1', cp, FALLBACK).text)).toContain('Você contou que ganha R$ 3.000,00 por mês');
  });

  it('M1-L1 em mês fechado não diz "até agora"', () => {
    const closed = ctxOf({ month: '2026-10' })!;
    const text = plain(personalizeHook('m1-l1', closed, FALLBACK).text);
    expect(text).toContain('em outubro.');
    expect(text).not.toContain('até agora');
  });

  it('M1-L2: delivery como % da renda; sem delivery cai na maior categoria; sem renda, só o valor', () => {
    expect(plain(personalizeHook('m1-l2', c, FALLBACK).text)).toContain(
      'R$ 312,40 em delivery são 16% de tudo o que você recebeu',
    );
    const noDelivery = ctxOf({
      summary: summary({
        byCategory: [{ categoryId: 'mercado', name: 'Mercado', color: '#0f0', totalInCents: 50_000 }],
      }),
    })!;
    expect(plain(personalizeHook('m1-l2', noDelivery, FALLBACK).text)).toContain('Mercado levou 25% da sua renda');
    const noIncome = ctxOf({ summary: summary({ incomeInCents: 0 }) })!;
    expect(plain(personalizeHook('m1-l2', noIncome, FALLBACK).text)).toContain('Mercado foi o que mais pesou');
  });

  it('M1-L3: assinaturas ativas, total mensal e anual', () => {
    const h = personalizeHook('m1-l3', c, FALLBACK);
    expect(plain(h.text)).toContain('2 assinaturas ativas que somam R$ 77,80 por mês, R$ 933,60 por ano');
  });

  it('sem contexto (null), sem dado pra aquela lição ou lição sem personalização: o gancho original, intocado', () => {
    expect(personalizeHook('m1-l1', null, FALLBACK)).toEqual({ text: FALLBACK, personalized: false });
    const onlySubs = ctxOf({ summary: null })!;
    expect(personalizeHook('m1-l1', onlySubs, FALLBACK)).toEqual({ text: FALLBACK, personalized: false });
    expect(personalizeHook('m1-l3', ctxOf({ subscriptions: null })!, FALLBACK).personalized).toBe(false);
    expect(personalizeHook('m9-l9', c, FALLBACK)).toEqual({ text: FALLBACK, personalized: false });
  });
});

describe('predefinições dos simuladores', () => {
  const c = ctxOf()!;

  it('Ralo: sem delivery mantém R$ 20 x 4; com delivery calibra a frequência e traz a renda real', () => {
    expect(raloPreset(null)).toEqual({ valor: 20, vezes: 4, salarioCents: null, hint: null });
    const p = raloPreset(c);
    expect(p.valor).toBe(20);
    expect(p.vezes).toBe(4); // 312,40 / (20 x 4,33) = 3,6 -> 4 por semana
    expect(p.salarioCents).toBe(200_000);
    expect(plain(p.hint ?? '')).toContain('R$ 312,40');
  });

  it('Ralo: nunca sai da régua (1 a 7 vezes por semana)', () => {
    const huge = { ...c, deliveryCents: 5_000_000 };
    const tiny = { ...c, deliveryCents: 500 };
    expect(raloPreset(huge).vezes).toBe(7);
    expect(raloPreset(tiny).vezes).toBe(1);
  });

  it('Fatias: renda real (de 100 em 100) e percentuais só com gasto classificado suficiente', () => {
    expect(fatiasPreset(null)).toBeNull();
    expect(fatiasPreset({ ...c, incomeCents: 0 })).toBeNull();
    // necessidades 45% (mercado+casa), desejos 25,6% -> 26
    expect(fatiasPreset(c)).toMatchObject({ renda: 2000, nec: 45, des: 26 });
    const sparse = { ...c, needsCents: 1_000, wantsCents: 1_000 };
    expect(fatiasPreset(sparse)).toMatchObject({ renda: 2000, nec: null, des: null });
    const bigNeeds = { ...c, needsCents: 190_000, wantsCents: 100_000 };
    const p = fatiasPreset(bigNeeds)!;
    expect(p.nec).toBe(85); // limitado à régua
    expect(p.nec! + p.des!).toBeLessThanOrEqual(100);
  });

  it('Bisturi: usa as assinaturas reais; sem assinatura volta a lista genérica (null)', () => {
    expect(bisturiItems(c)).toEqual([
      { id: 'sub-0', label: 'Netflix', mensal: 5_590 },
      { id: 'sub-1', label: 'Spotify', mensal: 2_190 },
    ]);
    expect(bisturiItems(ctxOf({ subscriptions: null }))).toBeNull();
    expect(bisturiItems(null)).toBeNull();
  });

  it('Termômetro: saldo das contas e custo (necessidades, ou o total); sem nada, didático', () => {
    expect(termometroPreset(null)).toBeNull();
    expect(termometroPreset(c)).toEqual({ guardado: 2_600, custoBasico: 900 }); // 2.500 -> 2.600 (passo 200)
    const semNec = { ...c, needsCents: 0 } as LessonUserContext;
    expect(termometroPreset(semNec)?.custoBasico).toBe(1_500);
    const semNada = { ...c, balanceCents: null, needsCents: 0, spentCents: 0 };
    expect(termometroPreset(semNada)).toBeNull();
  });
});
