// Lições com os números DA PESSOA (T4.5). Tudo puro: a página busca resumo, plano e assinaturas, monta o contexto
// aqui e o player/simuladores só consomem. Sem dado (conta nova, API fora) o contexto é `null` e cada lição
// continua com o texto e os valores didáticos de sempre: personalizar nunca pode quebrar uma lição.
import type { FinancialPlan, MonthSummaryResponse, SubscriptionsResponse } from '@tostao/contracts';
import { money, monthName } from './format';

/** Categorias do sistema por "tipo de gasto" da regra 50/30/20. Customizadas e "Outros" ficam de fora (não chutamos). */
const NEEDS = new Set(['mercado', 'transporte', 'casa', 'saude', 'estudo']);
const WANTS = new Set(['delivery', 'comer-fora', 'assinaturas', 'role', 'compras', 'jogos', 'apostas']);

/** Lições que de fato usam os números da pessoa (gancho e/ou simulador). As outras nem buscam dado. */
export const LESSONS_WITH_CONTEXT: ReadonlySet<string> = new Set(['m1-l1', 'm1-l2', 'm1-l3', 'm4-l5']);

export type LessonUserContext = {
  month: string;
  isCurrentMonth: boolean;
  incomeCents: number;
  /** De onde veio a renda: o que ENTROU no extrato do mês, ou o que a pessoa contou no plano. */
  incomeSource: 'extrato' | 'plano' | null;
  spentCents: number;
  topCategory: { name: string; totalCents: number } | null;
  deliveryCents: number;
  needsCents: number;
  wantsCents: number;
  subscriptions: { name: string; monthlyCents: number }[];
  subscriptionsMonthlyCents: number;
  subscriptionsYearlyCents: number;
  /** Saldo somado das contas (null = sem banco conectado). */
  balanceCents: number | null;
};

export function planIncomeCents(plan: FinancialPlan | null): number {
  if (!plan) return 0;
  return (
    (plan.salary?.amountInCents ?? 0) +
    plan.otherIncomes.filter((i) => i.countsAsIncome).reduce((sum, i) => sum + i.amountInCents, 0)
  );
}

export function buildLessonContext(input: {
  month: string;
  currentMonth: string;
  summary: MonthSummaryResponse | null;
  plan: FinancialPlan | null;
  subscriptions: SubscriptionsResponse | null;
}): LessonUserContext | null {
  const { summary, plan, subscriptions } = input;
  const statementIncome = summary?.incomeInCents ?? 0;
  const planIncome = planIncomeCents(plan);
  const incomeCents = statementIncome > 0 ? statementIncome : planIncome;
  const incomeSource = statementIncome > 0 ? 'extrato' : planIncome > 0 ? 'plano' : null;

  const real = (summary?.byCategory ?? []).filter((c) => c.categoryId !== null && c.totalInCents > 0);
  const top = [...real].sort((a, b) => b.totalInCents - a.totalInCents)[0];
  const sumOf = (ids: Set<string>) =>
    real.filter((c) => c.categoryId && ids.has(c.categoryId)).reduce((s, c) => s + c.totalInCents, 0);

  const active = (subscriptions?.subscriptions ?? []).filter((s) => s.active);
  const subs = [...active]
    .sort((a, b) => b.amountInCents - a.amountInCents)
    .slice(0, 6)
    .map((s) => ({ name: s.name, monthlyCents: s.amountInCents }));

  const ctx: LessonUserContext = {
    month: input.month,
    isCurrentMonth: input.month === input.currentMonth,
    incomeCents,
    incomeSource,
    spentCents: summary?.outcomeInCents ?? 0,
    topCategory: top ? { name: top.name, totalCents: top.totalInCents } : null,
    deliveryCents: real.find((c) => c.categoryId === 'delivery')?.totalInCents ?? 0,
    needsCents: sumOf(NEEDS),
    wantsCents: sumOf(WANTS),
    subscriptions: subs,
    subscriptionsMonthlyCents: subscriptions?.monthlyInCents ?? 0,
    subscriptionsYearlyCents: subscriptions?.yearlyInCents ?? 0,
    balanceCents: summary?.balanceInCents ?? null,
  };
  const hasAnything =
    ctx.incomeCents > 0 || ctx.spentCents > 0 || ctx.subscriptions.length > 0 || (ctx.balanceCents ?? 0) > 0;
  return hasAnything ? ctx : null;
}

// ---------- Gancho ("Seu extrato") ----------

const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

/**
 * Troca o gancho didático pelo da pessoa quando há número pra isso. `personalized` diz à tela se deve mostrar o selo
 * "Seu extrato". Sem dado suficiente pra aquela lição, devolve o gancho original, sem mudar nada.
 */
export function personalizeHook(
  lessonId: string,
  ctx: LessonUserContext | null,
  fallback: string,
): { text: string; personalized: boolean } {
  const keep = { text: fallback, personalized: false };
  if (!ctx) return keep;
  const mes = `${monthName(ctx.month)}${ctx.isCurrentMonth ? ' (até agora)' : ''}`;
  const top = ctx.topCategory ? `O maior ralo: ${ctx.topCategory.name}, ${money(ctx.topCategory.totalCents)}. ` : '';
  const ok = (text: string) => ({ text, personalized: true });

  switch (lessonId) {
    case 'm1-l1': {
      if (ctx.spentCents <= 0) return keep;
      if (ctx.incomeSource === 'extrato')
        return ok(
          `Entrou ${money(ctx.incomeCents)} e saiu ${money(ctx.spentCents)} em ${mes}. ${top}Pra onde foi o resto? O Caramelo já farejou os rastros.`,
        );
      if (ctx.incomeSource === 'plano')
        return ok(
          `Você contou que ganha ${money(ctx.incomeCents)} por mês e em ${mes} já saíram ${money(ctx.spentCents)}. ${top}O Caramelo já farejou os rastros: pra onde foi o resto?`,
        );
      return ok(`Em ${mes} saíram ${money(ctx.spentCents)} da sua conta. ${top}O Caramelo já farejou os rastros.`);
    }
    case 'm1-l2': {
      const who = ctx.incomeSource === 'extrato' ? 'recebeu' : 'ganha';
      if (ctx.incomeCents > 0 && ctx.deliveryCents > 0 && pct(ctx.deliveryCents, ctx.incomeCents) >= 1)
        return ok(
          `${money(ctx.deliveryCents)} em delivery são ${pct(ctx.deliveryCents, ctx.incomeCents)}% de tudo o que você ${who} em ${mes}. O Caramelo já tá de olho na caixa.`,
        );
      if (ctx.incomeCents > 0 && ctx.topCategory)
        return ok(
          `${ctx.topCategory.name} levou ${pct(ctx.topCategory.totalCents, ctx.incomeCents)}% da sua renda em ${mes} (${money(ctx.topCategory.totalCents)}). Cabe na pizza?`,
        );
      if (ctx.topCategory)
        return ok(`${ctx.topCategory.name} foi o que mais pesou em ${mes}: ${money(ctx.topCategory.totalCents)}.`);
      return keep;
    }
    case 'm1-l3': {
      const n = ctx.subscriptions.length;
      if (n === 0 || ctx.subscriptionsMonthlyCents <= 0) return keep;
      return ok(
        `Você tem ${n} ${n === 1 ? 'assinatura ativa' : 'assinaturas ativas'} que somam ${money(ctx.subscriptionsMonthlyCents)} por mês, ${money(ctx.subscriptionsYearlyCents)} por ano. Vale passar o bisturi?`,
      );
    }
    case 'm4-l5': {
      if ((ctx.balanceCents ?? 0) <= 0 || ctx.spentCents <= 0) return keep;
      return ok(
        `Você tem ${money(ctx.balanceCents ?? 0)} nas contas e em ${mes} gastou ${money(ctx.spentCents)}. Quantos meses isso aguenta?`,
      );
    }
    default:
      return keep;
  }
}

// ---------- Pré-preenchimento dos simuladores ----------
// Cada `*Preset` devolve `null` quando não há dado pra aquele simulador: ele abre com os valores didáticos de sempre.

const WEEKS_PER_MONTH = 4.33;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const snap = (reais: number, step: number) => Math.round(reais / step) * step;

/** Ralo do cafezinho (M1-L1): R$ 20 por pedido, e a frequência por semana que reproduz o delivery do mês. */
export function raloPreset(ctx: LessonUserContext | null): {
  valor: number;
  vezes: number;
  salarioCents: number | null;
  hint: string | null;
} {
  const salarioCents = ctx && ctx.incomeCents > 0 ? ctx.incomeCents : null;
  if (!ctx || ctx.deliveryCents <= 0) return { valor: 20, vezes: 4, salarioCents, hint: null };
  const vezes = clamp(Math.round(ctx.deliveryCents / 100 / (20 * WEEKS_PER_MONTH)), 1, 7);
  return {
    valor: 20,
    vezes,
    salarioCents,
    hint: `Ajustado ao seu delivery de ${monthName(ctx.month)} (${money(ctx.deliveryCents)}).`,
  };
}

/** Fatias 50/30/20 (M1-L2): a renda real; os percentuais só se os gastos classificados somarem pelo menos 10% dela. */
export function fatiasPreset(
  ctx: LessonUserContext | null,
): { renda: number; nec: number | null; des: number | null; hint: string } | null {
  if (!ctx || ctx.incomeCents <= 0) return null;
  const renda = Math.max(100, snap(ctx.incomeCents / 100, 100));
  const classified = ctx.needsCents + ctx.wantsCents;
  if (classified < ctx.incomeCents * 0.1)
    return { renda, nec: null, des: null, hint: `Começa com a sua renda de ${monthName(ctx.month)}.` };
  const nec = clamp(pct(ctx.needsCents, ctx.incomeCents), 30, 85);
  const des = Math.min(clamp(pct(ctx.wantsCents, ctx.incomeCents), 5, 60), 100 - nec);
  return {
    renda,
    nec,
    des,
    hint: `Começa com a sua renda e os seus gastos de ${monthName(ctx.month)}. Mexa à vontade.`,
  };
}

/** Bisturi no fixo (M1-L3): as assinaturas que o Tostão achou no extrato, no lugar da lista genérica. */
export function bisturiItems(ctx: LessonUserContext | null): { id: string; label: string; mensal: number }[] | null {
  if (!ctx || ctx.subscriptions.length === 0) return null;
  return ctx.subscriptions.map((s, i) => ({ id: `sub-${i}`, label: s.name, mensal: s.monthlyCents }));
}

/** Termômetro da paz de espírito (M4-L5): saldo das contas e custo do mês (o que é necessidade, ou o total). */
export function termometroPreset(ctx: LessonUserContext | null): { guardado: number; custoBasico: number } | null {
  if (!ctx) return null;
  const balance = ctx.balanceCents ?? 0;
  const cost = ctx.needsCents > 0 ? ctx.needsCents : ctx.spentCents;
  if (balance <= 0 && cost <= 0) return null;
  return {
    guardado: balance > 0 ? Math.max(0, snap(balance / 100, 200)) : 3600,
    custoBasico: cost > 0 ? Math.max(100, snap(cost / 100, 100)) : 1800,
  };
}
