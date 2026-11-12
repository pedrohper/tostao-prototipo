import type { FinancialPlan, ForecastMonth, Goal, GoalStatus, IncomeSuggestion } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import type { Transaction } from '../domain/entities.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import { currentMonth } from '../lib/month.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { normalizeDescription } from '../lib/text.js';
import { patternFromDescription } from '../services/categorize.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';

const DAY = 24 * 60 * 60 * 1000;
const SALARY_CATEGORY_ID = 'salario';

export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const monthOf = (d: Date) => currentMonth(d);
const monthsBetween = (a: string, b: string) => {
  const [ya, ma] = a.split('-').map(Number) as [number, number];
  const [yb, mb] = b.split('-').map(Number) as [number, number];
  return (yb - ya) * 12 + (mb - ma);
};

/** Renda que conta: salário + outras entradas marcadas como renda. */
export const planIncome = (p: FinancialPlan) =>
  (p.salary?.amountInCents ?? 0) + p.otherIncomes.filter((i) => i.countsAsIncome).reduce((s, i) => s + i.amountInCents, 0);
export const planFixed = (p: FinancialPlan) => p.fixedExpenses.reduce((s, f) => s + f.amountInCents, 0);

/**
 * Salva o que a pessoa contou no onboarding.
 * Padrões do extrato viram regra: salário cai em "Salário e renda"; "só repasso" cai em "Não conta"
 * (sai da renda e do gasto). Aplica também no histórico, pra tela já ficar certa.
 */
export class SaveFinancialPlanUseCase {
  constructor(private readonly repos: Pick<Repositories, 'plans' | 'rules' | 'transactions'>, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId, plan }: { userId: string; plan: FinancialPlan }) {
    const marks: { pattern: string; categoryId: string }[] = [];
    if (plan.salary?.pattern) marks.push({ pattern: plan.salary.pattern, categoryId: SALARY_CATEGORY_ID });
    for (const i of plan.otherIncomes) if (i.pattern) marks.push({ pattern: i.pattern, categoryId: i.countsAsIncome ? SALARY_CATEGORY_ID : NEUTRAL_CATEGORY_ID });

    const clean = (p: string) => patternFromDescription(p);
    const normalized = {
      ...plan,
      salary: plan.salary ? { ...plan.salary, pattern: plan.salary.pattern ? clean(plan.salary.pattern) : null } : null,
      otherIncomes: plan.otherIncomes.map((i) => ({ ...i, pattern: i.pattern ? clean(i.pattern) : null })),
    };
    // A meta guarda quanto já foi guardado: o formulário da renda não manda isso, então mantém o que tinha.
    if (normalized.goal && normalized.goal.savedInCents === undefined) {
      const before = await this.repos.plans.get(userId);
      normalized.goal = { ...normalized.goal, savedInCents: before?.goal?.savedInCents ?? 0 };
    }
    await this.repos.plans.save(userId, normalized);

    let updated = 0;
    const rules = marks.map((m) => ({ ...m, pattern: clean(m.pattern) })).filter((m) => m.pattern.length >= 3);
    if (rules.length) {
      for (const r of rules) await this.repos.rules.upsert({ userId, pattern: r.pattern, categoryId: r.categoryId });
      const now = this.now();
      const txs = await this.repos.transactions.findManyInRange(userId, new Date(now.getTime() - 400 * DAY), new Date(now.getTime() + DAY));
      for (const t of txs) {
        if (t.amountInCents <= 0) continue;
        const text = normalizeDescription(t.description);
        const r = rules.filter((x) => text.includes(x.pattern)).sort((a, b) => b.pattern.length - a.pattern.length)[0];
        if (!r || t.categoryId === r.categoryId) continue;
        const internal = r.categoryId === NEUTRAL_CATEGORY_ID ? true : t.categoryId === NEUTRAL_CATEGORY_ID ? false : t.isInternalTransfer;
        await this.repos.transactions.save({ ...t, categoryId: r.categoryId, isInternalTransfer: internal });
        updated++;
      }
    }
    return { plan: normalized, updated };
  }
}

/** Entradas que se repetem nos últimos meses: o onboarding mostra pra pessoa dizer o que é salário e o que é repasse. */
export class SuggestIncomeUseCase {
  constructor(private readonly repos: Pick<Repositories, 'transactions' | 'accounts'>, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId }: { userId: string }): Promise<{ suggestions: IncomeSuggestion[] }> {
    const now = this.now();
    const [txs, accounts] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, new Date(now.getTime() - 120 * DAY), new Date(now.getTime() + DAY)),
      this.repos.accounts.listByUser(userId),
    ]);
    const acc = new Map(accounts.map((a) => [a.id, a]));
    const groups = new Map<string, Transaction[]>();
    for (const t of txs) {
      if (t.amountInCents <= 0) continue;
      const a = t.accountId ? acc.get(t.accountId) : null;
      if (a?.hidden || a?.type === 'CREDIT') continue; // estorno de cartão não é renda
      // Transferência entre contas próprias fica de fora; "Não conta" entra, pra pessoa poder mudar de ideia.
      if (t.isInternalTransfer && t.categoryId !== NEUTRAL_CATEGORY_ID) continue;
      const key = patternFromDescription(t.description);
      if (key.length < 3) continue;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const suggestions: IncomeSuggestion[] = [];
    for (const [pattern, list] of groups) {
      const total = list.reduce((s, t) => s + t.amountInCents, 0);
      const months = new Set(list.map((t) => monthOf(t.occurredAt))).size;
      if (months < 2 && total < 50000) continue; // uma entrada pequena e solta não é renda recorrente
      list.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      const last = list[0]!;
      suggestions.push({
        pattern,
        sample: last.description,
        bank: last.accountId ? acc.get(last.accountId)?.name ?? null : null,
        monthlyAvgInCents: Math.round(total / Math.max(1, months)),
        months,
        hits: list.slice(0, 6).map((t) => ({ date: t.occurredAt.toISOString(), amountInCents: t.amountInCents })),
        countsAsIncome: last.categoryId !== NEUTRAL_CATEGORY_ID,
      });
    }
    suggestions.sort((a, b) => b.monthlyAvgInCents - a.monthlyAvgInCents);
    return { suggestions: suggestions.slice(0, 6) };
  }
}

const GOAL_LABEL: Record<Goal['kind'], string> = { reserva: 'Reserva', viagem: 'Viagem', 'sair-do-vermelho': 'Sair do vermelho', outro: 'Minha meta' };

/** Quanto falta e quanto guardar por mês. Prazo "2027-07" = até o fim de julho: de novembro são 8 meses (dez a jul). */
export function goalStatus(goal: Goal, cur: string, nextLeftInCents: number | null): GoalStatus {
  const saved = goal.savedInCents ?? 0;
  const amount = goal.amountInCents;
  const monthsLeft = goal.deadline ? Math.max(1, monthsBetween(cur, goal.deadline)) : null;
  const missing = amount === null ? null : Math.max(0, amount - saved);
  const monthly = missing === null || monthsLeft === null ? null : Math.ceil(missing / monthsLeft);
  return {
    label: goal.label ?? GOAL_LABEL[goal.kind],
    amountInCents: amount,
    savedInCents: saved,
    deadline: goal.deadline,
    monthsLeft,
    monthlyNeededInCents: monthly,
    fits: monthly === null || nextLeftInCents === null ? null : monthly <= nextLeftInCents,
    reached: amount !== null && amount > 0 && saved >= amount,
  };
}

/** Criar, trocar ou apagar a meta sem passar pelo formulário da renda. */
export class SetGoalUseCase {
  constructor(private readonly repos: Pick<Repositories, 'plans'>) {}

  async execute({ userId, goal }: { userId: string; goal: Goal | null }) {
    const plan = await this.repos.plans.get(userId);
    const base: FinancialPlan = plan ?? { salary: null, otherIncomes: [], fixedExpenses: [], benefits: [], goal: null };
    const next = goal ? { ...goal, savedInCents: goal.savedInCents ?? base.goal?.savedInCents ?? 0 } : null;
    await this.repos.plans.save(userId, { ...base, goal: next });
    return { goal: next };
  }
}

/** "Guardei R$ 50" soma; valor negativo tira. Nunca fica abaixo de zero. */
export class GoalDepositUseCase {
  constructor(private readonly repos: Pick<Repositories, 'plans'>) {}

  async execute({ userId, amountInCents }: { userId: string; amountInCents: number }) {
    const plan = await this.repos.plans.get(userId);
    if (!plan?.goal) throw new ResourceNotFoundError('Meta');
    const savedInCents = Math.max(0, (plan.goal.savedInCents ?? 0) + amountInCents);
    await this.repos.plans.save(userId, { ...plan, goal: { ...plan.goal, savedInCents } });
    return { savedInCents };
  }
}

/** Parcela "3/10" na descrição da compra no cartão. */
const INSTALLMENT = /(?:^|\D)(\d{1,2})\s*\/\s*(\d{1,2})(?:\D|$)/;

/**
 * Previsão dos próximos 3 meses:
 * renda do plano − contas fixas − assinaturas − parcelas que ainda vão cair − dia a dia (média de 3 meses
 * já sem assinaturas, contas fixas e parcelas, pra não contar duas vezes). É estimativa, e a tela diz isso.
 */
export class ForecastUseCase {
  constructor(private readonly repos: Repositories, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId, months = 3 }: { userId: string; months?: number }): Promise<{ hasPlan: boolean; months: ForecastMonth[]; goal: GoalStatus | null }> {
    const plan = await this.repos.plans.get(userId);
    if (!plan) return { hasPlan: false, months: [], goal: null };
    const now = this.now();
    const cur = currentMonth(now);
    const summary = new GetMonthSummaryUseCase(this.repos);
    const [past, subs, accounts, recent] = await Promise.all([
      Promise.all([1, 2, 3].map((k) => summary.execute({ userId, month: shiftMonth(cur, -k) }))),
      new ListSubscriptionsUseCase(this.repos, () => now).execute({ userId }),
      this.repos.accounts.listByUser(userId),
      this.repos.transactions.findManyInRange(userId, new Date(now.getTime() - 62 * DAY), new Date(now.getTime() + DAY)),
    ]);

    // Parcelas: fica só a ocorrência mais recente de cada compra parcelada.
    const cards = new Set(accounts.filter((a) => a.type === 'CREDIT' && !a.hidden).map((a) => a.id));
    const latest = new Map<string, { n: number; total: number; month: string; amount: number }>();
    for (const t of recent) {
      if (t.amountInCents >= 0 || t.isInternalTransfer || !t.accountId || !cards.has(t.accountId)) continue;
      const m = INSTALLMENT.exec(t.description);
      if (!m) continue;
      const n = Number(m[1]), total = Number(m[2]);
      if (total < 2 || n < 1 || n >= total || total > 48) continue;
      const key = `${patternFromDescription(t.description)}|${t.amountInCents}`;
      const month = monthOf(t.occurredAt);
      const prev = latest.get(key);
      if (!prev || monthsBetween(prev.month, month) > 0 || (month === prev.month && n > prev.n)) latest.set(key, { n, total, month, amount: -t.amountInCents });
    }
    const installmentsIn = (month: string) => {
      let sum = 0;
      for (const i of latest.values()) if (i.n + monthsBetween(i.month, month) <= i.total) sum += i.amount;
      return sum;
    };

    const income = planIncome(plan);
    const fixed = planFixed(plan);
    const subscriptions = subs.monthlyInCents;
    const withData = past.filter((s) => s.outcomeInCents > 0);
    const avgOut = withData.length ? Math.round(withData.reduce((s, x) => s + x.outcomeInCents, 0) / withData.length) : 0;
    const daily = Math.max(0, avgOut - subscriptions - fixed - installmentsIn(cur));

    const out: ForecastMonth[] = [];
    for (let k = 1; k <= months; k++) {
      const month = shiftMonth(cur, k);
      const inst = installmentsIn(month);
      out.push({
        month,
        incomeInCents: income,
        fixedInCents: fixed,
        subscriptionsInCents: subscriptions,
        installmentsInCents: inst,
        dailyInCents: daily,
        leftInCents: income - fixed - subscriptions - inst - daily,
        benefitsInCents: (plan.benefits ?? []).reduce((s, b) => s + b.amountInCents, 0),
      });
    }
    // Sem salário informado (ex.: só criou a meta), a previsão não tem base: não diz se cabe.
    const hasIncome = income > 0;
    return {
      hasPlan: hasIncome || fixed > 0,
      months: hasIncome || fixed > 0 ? out : [],
      goal: plan.goal ? goalStatus(plan.goal, cur, hasIncome ? out[0]?.leftInCents ?? null : null) : null,
    };
  }
}
