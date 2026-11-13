import type { FinancialPlan, ForecastItem, ForecastMonth, Goal, GoalStatus, IncomeSuggestion, SpendingBase, SpendingBaseMonth, ThisMonthForecast } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import type { Transaction } from '../domain/entities.js';
import { NEUTRAL_CATEGORY_ID } from '../domain/entities.js';
import { currentMonth } from '../lib/month.js';
import { ResourceNotFoundError } from '../domain/errors.js';
import { normalizeDescription } from '../lib/text.js';
import { patternFromDescription } from '../services/categorize.js';
import { GetMonthSummaryUseCase } from './get-month-summary.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';
import { subscriptionKey } from '../services/subscriptions.js';

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

/** Descrição que o próprio banco usa pra salário: "CREDITO DE SALARIO", "TRANSF SALDO C/SAL P/CC" (portabilidade), folha. */
const SALARY_SIGNAL = /SALARIO|C\/SAL\b|FOLHA|PROVENTO/;

/**
 * Quanto entra por mês desse padrão. O mesmo nome pode juntar coisas diferentes
 * (adiantamento ~R$ 1.000 no dia 15, resto ~R$ 1.200 no fim do mês, um acerto de R$ 3.700 uma vez só):
 * separa por faixa de valor (12%), soma a mediana de cada faixa que se repete em 2+ meses e ignora o que veio uma vez.
 */
export function recurringMonthly(list: Transaction[], _months: number): number {
  const bands: Transaction[][] = [];
  for (const t of [...list].sort((a, b) => a.amountInCents - b.amountInCents)) {
    const band = bands.find((b) => { const m = medianOf(b.map((x) => x.amountInCents)); return Math.abs(t.amountInCents - m) <= m * 0.12; });
    if (band) band.push(t); else bands.push([t]);
  }
  // Repete = 2+ vezes com pelo menos ~3 semanas entre a primeira e a última (o salário de setembro pode cair dia 01/10).
  const span = (b: Transaction[]) => Math.max(...b.map((t) => t.occurredAt.getTime())) - Math.min(...b.map((t) => t.occurredAt.getTime()));
  const recurring = bands.filter((b) => b.length >= 2 && span(b) >= 20 * DAY);
  // Nada se repete ainda: o valor típico de uma entrada (mediana), não o total do mês, que mistura acerto e atraso.
  if (!recurring.length) return list.length ? medianOf(list.map((t) => t.amountInCents)) : 0;
  return recurring.reduce((s, b) => s + medianOf(b.map((t) => t.amountInCents)), 0);
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
    const suggestions: (IncomeSuggestion & { signal: boolean })[] = [];
    for (const [pattern, list] of groups) {
      const total = list.reduce((s, t) => s + t.amountInCents, 0);
      const months = new Set(list.map((t) => monthOf(t.occurredAt))).size;
      const signal = SALARY_SIGNAL.test(pattern);
      // Uma entrada pequena e solta não é renda recorrente (a não ser que o banco diga que é salário).
      if (months < 2 && total < 50000 && !signal) continue;
      list.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
      const last = list[0]!;
      suggestions.push({
        pattern,
        signal,
        sample: last.description,
        bank: last.accountId ? acc.get(last.accountId)?.name ?? null : null,
        monthlyAvgInCents: recurringMonthly(list, months),
        months,
        hits: list.slice(0, 6).map((t) => ({ date: t.occurredAt.toISOString(), amountInCents: t.amountInCents })),
        countsAsIncome: last.categoryId !== NEUTRAL_CATEGORY_ID,
      });
    }
    suggestions.sort((a, b) => Number(b.signal) - Number(a.signal) || b.monthlyAvgInCents - a.monthlyAvgInCents);
    return { suggestions: suggestions.slice(0, 6).map(({ signal: _, ...x }) => x) };
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

export type PendingInstallment = { description: string; accountId: string; n: number; total: number; month: string; amount: number };
/** Compras parceladas no cartão que ainda têm parcela pra cair (fica só a ocorrência mais recente de cada uma). */
export function pendingInstallments(txs: Transaction[], cardIds: Set<string>): PendingInstallment[] {
  const latest = new Map<string, PendingInstallment>();
  for (const t of txs) {
    // Anotado à mão como parcelado já tem as próximas parcelas lançadas: não projeta de novo.
    if (t.amountInCents >= 0 || t.isInternalTransfer || !t.accountId || !cardIds.has(t.accountId) || t.seriesId) continue;
    const m = INSTALLMENT.exec(t.description);
    if (!m) continue;
    const n = Number(m[1]), total = Number(m[2]);
    if (total < 2 || n < 1 || n >= total || total > 48) continue;
    const key = `${patternFromDescription(t.description)}|${t.amountInCents}`;
    const month = monthOf(t.occurredAt);
    const prev = latest.get(key);
    if (!prev || monthsBetween(prev.month, month) > 0 || (month === prev.month && n > prev.n)) {
      latest.set(key, { description: t.description, accountId: t.accountId, n, total, month, amount: -t.amountInCents });
    }
  }
  return [...latest.values()];
}
/** Parcelas que caem num mês, com o número de cada uma. */
export const installmentsOfMonth = (list: PendingInstallment[], month: string) =>
  list.flatMap((i) => {
    const n = i.n + monthsBetween(i.month, month);
    return n >= i.n && n <= i.total ? [{ ...i, n }] : [];
  });
/** Quanto das parcelas cai num mês. */
export const installmentsInMonth = (list: PendingInstallment[], month: string) =>
  list.filter((i) => i.n + monthsBetween(i.month, month) <= i.total).reduce((s, i) => s + i.amount, 0);
const medianOf = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

/** Entrada acima disso (x renda normal) é dinheiro extra: acerto, 13º, restituição, venda. */
const EXTRA_INCOME_FACTOR = 1.3;
/** Gasto acima disso (x renda normal) sem dinheiro extra pra cobrir é aperto. */
const OVERSPEND_FACTOR = 1.1;

/**
 * Base do dia a dia que entende de onde saiu o dinheiro.
 * Mês com entrada bem acima da renda normal guarda o excesso num "pote extra". Nos meses seguintes,
 * o que passar da renda normal é pago primeiro com esse pote e sai da base (é exceção, não hábito).
 * O que sobrar acima da renda sem pote pra cobrir continua na base: aí é aperto de verdade.
 * `history` em ordem do mais antigo pro mais recente.
 */
export function spendingBase(history: { month: string; incomeInCents: number; outcomeInCents: number }[], normalIncome: number): SpendingBase {
  const income = normalIncome > 0 ? normalIncome : medianOf(history.filter((h) => h.incomeInCents > 0).map((h) => h.incomeInCents));
  let pool = 0;
  const months: SpendingBaseMonth[] = history.map((h) => {
    const extra = income > 0 && h.incomeInCents > income * EXTRA_INCOME_FACTOR ? h.incomeInCents - income : 0;
    pool += extra;
    const over = income > 0 ? Math.max(0, h.outcomeInCents - income) : 0;
    const paid = Math.min(pool, over);
    pool -= paid;
    return { month: h.month, incomeInCents: h.incomeInCents, outcomeInCents: h.outcomeInCents, extraIncomeInCents: extra, paidWithExtraInCents: paid, baseInCents: h.outcomeInCents - paid };
  });
  const last3 = months.filter((m) => m.outcomeInCents > 0).slice(-3);
  const typical = medianOf(last3.map((m) => m.baseInCents));
  // Compara com o que entrou de renda comum naquele mês (sem o extra): se o mês rendeu mais, gastar mais cabe.
  const overspent = income > 0 ? last3.filter((m) => m.baseInCents > Math.max(income, m.incomeInCents - m.extraIncomeInCents) * OVERSPEND_FACTOR).length : 0;
  const status: SpendingBase['status'] = overspent >= 2 ? 'aperto' : last3.some((m) => m.paidWithExtraInCents > 0) ? 'excecao' : 'ok';
  return { normalIncomeInCents: income, typicalInCents: typical, status, months: last3 };
}

/** Dia do mês em Brasília. */
const brDay = (d: Date) => new Date(d.getTime() - 3 * 60 * 60 * 1000).getUTCDate();

/**
 * Previsão dos próximos 3 meses:
 * renda do plano − contas fixas − assinaturas − parcelas que ainda vão cair − dia a dia (mediana de 3 meses,
 * sem o que foi pago com dinheiro extra e já sem assinaturas, contas fixas e parcelas, pra não contar duas vezes). É estimativa, e a tela diz isso.
 */
export class ForecastUseCase {
  constructor(private readonly repos: Repositories, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId, months = 3 }: { userId: string; months?: number }): Promise<{ hasPlan: boolean; months: ForecastMonth[]; goal: GoalStatus | null; thisMonth: ThisMonthForecast | null; base: SpendingBase | null }> {
    const plan = await this.repos.plans.get(userId);
    if (!plan) return { hasPlan: false, months: [], goal: null, thisMonth: null, base: null };
    const now = this.now();
    const cur = currentMonth(now);
    const summary = new GetMonthSummaryUseCase(this.repos);
    const firstFuture = new Date(`${shiftMonth(cur, 1)}-01T03:00:00Z`);
    const afterLast = new Date(`${shiftMonth(cur, months + 1)}-01T03:00:00Z`);
    const [past, subs, accounts, recent, curSummary, scheduled] = await Promise.all([
      Promise.all([6, 5, 4, 3, 2, 1].map((k) => summary.execute({ userId, month: shiftMonth(cur, -k) }))),
      new ListSubscriptionsUseCase(this.repos, () => now).execute({ userId }),
      this.repos.accounts.listByUser(userId),
      this.repos.transactions.findManyInRange(userId, new Date(now.getTime() - 62 * DAY), new Date(now.getTime() + DAY)),
      summary.execute({ userId, month: cur }),
      this.repos.transactions.findManyInRange(userId, firstFuture, afterLast),
    ]);

    const cardAccounts = accounts.filter((a) => a.type === 'CREDIT' && !a.hidden);
    const cards = new Set(cardAccounts.map((a) => a.id));
    // Plano anual parcelado (Prime 5/12) já entra como assinatura: não conta de novo como parcela.
    const subKeys = new Set(subs.subscriptions.filter((x) => x.installmentsLeft !== null).map((x) => x.key.split('#')[0]));
    const pending = pendingInstallments(recent, cards).filter((i) => !subKeys.has(subscriptionKey(i.description)));
    const installmentsIn = (month: string) => installmentsInMonth(pending, month);

    const income = planIncome(plan);
    const fixed = planFixed(plan);
    const activeSubs = subs.subscriptions.filter((x) => x.active && x.installmentsLeft !== 0);
    const subscriptions = subs.monthlyInCents;
    const base = spendingBase(past.map((p, i) => ({ month: shiftMonth(cur, i - past.length), incomeInCents: p.incomeInCents, outcomeInCents: p.outcomeInCents })), income);
    const daily = Math.max(0, base.typicalInCents - subscriptions - fixed - installmentsIn(cur));
    const cardOf = (accountId: string | null | undefined) => (accountId && cards.has(accountId) ? accountId : null);

    const out: ForecastMonth[] = [];
    for (let k = 1; k <= months; k++) {
      const month = shiftMonth(cur, k);
      const inMonth = scheduled.filter((t) => currentMonth(t.occurredAt) === month && !t.isInternalTransfer);
      const items: ForecastItem[] = [];
      if (plan.salary?.amountInCents) items.push({ kind: 'renda', title: 'Salário', amountInCents: plan.salary.amountInCents, entrada: true, day: plan.salary.payday ?? null, cardId: null, detail: null });
      for (const o of plan.otherIncomes.filter((i) => i.countsAsIncome)) items.push({ kind: 'renda', title: o.name, amountInCents: o.amountInCents, entrada: true, day: o.day ?? null, cardId: null, detail: null });
      for (const f of plan.fixedExpenses) items.push({ kind: 'conta', title: f.name, amountInCents: f.amountInCents, entrada: false, day: f.day, cardId: null, detail: null });
      for (const x of activeSubs) {
        // Parcelado anual (x/12) que acaba antes desse mês não cobra mais.
        if (x.installmentsLeft !== null && x.installmentsLeft < k) continue;
        items.push({ kind: 'assinatura', title: x.name, amountInCents: x.amountInCents, entrada: false, day: brDay(x.nextChargeAt), cardId: cardOf(x.accountId), detail: null });
      }
      for (const i of installmentsOfMonth(pending, month)) {
        items.push({ kind: 'parcela', title: i.description.replace(/\s*\(?\b\d{1,2}\s*\/\s*\d{1,2}\b\)?/, '').trim(), amountInCents: i.amount, entrada: false, day: null, cardId: i.accountId, detail: `${i.n}/${i.total}` });
      }
      for (const t of inMonth) {
        const m = /\((\d{1,2})\/(\d{1,2})\)$/.exec(t.description);
        items.push({ kind: m ? 'parcela' : 'anotado', title: m ? t.description.replace(/\s*\(\d{1,2}\/\d{1,2}\)$/, '') : t.description, amountInCents: Math.abs(t.amountInCents), entrada: t.amountInCents > 0, day: brDay(t.occurredAt), cardId: cardOf(t.accountId), detail: m ? `${m[1]}/${m[2]}` : null });
      }
      items.sort((a, b) => Number(b.entrada) - Number(a.entrada) || (a.day ?? 99) - (b.day ?? 99) || b.amountInCents - a.amountInCents);

      const subsTotal = items.filter((i) => i.kind === 'assinatura').reduce((s, i) => s + i.amountInCents, 0);
      const inst = installmentsIn(month);
      const scheduledOut = inMonth.filter((t) => t.amountInCents < 0).reduce((s, t) => s - t.amountInCents, 0);
      const scheduledIn = inMonth.filter((t) => t.amountInCents > 0).reduce((s, t) => s + t.amountInCents, 0);
      const cardTotals = cardAccounts
        .map((a) => ({ id: a.id, name: a.name, dueDay: a.dueDate ? brDay(a.dueDate) : null, totalInCents: items.filter((i) => i.cardId === a.id && !i.entrada).reduce((s, i) => s + i.amountInCents, 0) }))
        .filter((c) => c.totalInCents > 0);
      out.push({
        month,
        incomeInCents: income,
        fixedInCents: fixed,
        subscriptionsInCents: subsTotal,
        installmentsInCents: inst,
        dailyInCents: daily,
        scheduledOutInCents: scheduledOut,
        scheduledInInCents: scheduledIn,
        leftInCents: income + scheduledIn - fixed - subsTotal - inst - scheduledOut - daily,
        benefitsInCents: (plan.benefits ?? []).reduce((s, b) => s + b.amountInCents, 0),
        items,
        cards: cardTotals,
      });
    }
    // Mês atual: o que já entrou/saiu de verdade + o que ainda deve sair até o último dia.
    const br = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = br.getUTCDate();
    const daysInMonth = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() + 1, 0)).getUTCDate();
    const daysLeft = daysInMonth - today;
    const fixedLeft = plan.fixedExpenses.filter((f) => f.day > today).reduce((sum, f) => sum + f.amountInCents, 0);
    const endOfMonth = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() + 1, 1, 3));
    const subsLeft = subs.subscriptions
      .filter((x) => x.active && new Date(x.nextChargeAt) > now && new Date(x.nextChargeAt) < endOfMonth)
      .reduce((sum, x) => sum + x.amountInCents, 0);
    const dailyLeft = Math.round((daily * daysLeft) / daysInMonth);
    const incomeNow = Math.max(income, curSummary.incomeInCents);
    const thisMonth: ThisMonthForecast = {
      month: cur,
      daysLeft,
      incomeInCents: incomeNow,
      spentInCents: curSummary.outcomeInCents,
      fixedLeftInCents: fixedLeft,
      subscriptionsLeftInCents: subsLeft,
      dailyLeftInCents: dailyLeft,
      leftInCents: incomeNow - curSummary.outcomeInCents - fixedLeft - subsLeft - dailyLeft,
    };

    // Sem salário informado (ex.: só criou a meta), a previsão não tem base: não diz se cabe.
    const hasIncome = income > 0;
    return {
      hasPlan: hasIncome || fixed > 0,
      thisMonth: hasIncome ? thisMonth : null,
      months: hasIncome || fixed > 0 ? out : [],
      goal: plan.goal ? goalStatus(plan.goal, cur, hasIncome ? out[0]?.leftInCents ?? null : null) : null,
      base: hasIncome || fixed > 0 ? base : null,
    };
  }
}
