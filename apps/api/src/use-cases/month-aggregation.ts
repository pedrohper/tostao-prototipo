import { cardIdentity } from './card-identity.js';
import type { Account, Category, Transaction } from '../domain/entities.js';
import type { Repositories } from '../repositories/types.js';
import { currentMonth, monthRange } from '../lib/month.js';
import { civilParts } from '../lib/tz.js';
import { MANUAL_PREFIX } from './import-statement.js';

/**
 * T2.1 · Agregação mensal em lote.
 * Em vez de cada resumo de mês ir ao banco (4 a 5 queries x 7 meses na previsão, x várias telas no chat), carregamos
 * contas, categorias e UMA janela de lançamentos (3 queries) e resumimos quantos meses precisar na memória.
 */

/** Tudo que os resumos precisam, já carregado. `txs` cobre a janela pedida em `loadFinance` (mais recente primeiro). */
export type FinanceSnapshot = {
  tz: string;
  accounts: Account[];
  categories: Category[];
  txs: Transaction[];
};

/** Lançamentos no intervalo [from, to), mantendo a ordem da lista (a mesma de `findManyInRange`). */
export const sliceRange = (txs: Transaction[], from: Date, to: Date) =>
  txs.filter((t) => t.occurredAt >= from && t.occurredAt < to);

/** 3 queries: contas, categorias e os lançamentos de [from, to). */
export async function loadFinance(
  repos: Pick<Repositories, 'transactions' | 'categories' | 'accounts'>,
  userId: string,
  { tz, from, to }: { tz: string; from: Date; to: Date },
): Promise<FinanceSnapshot> {
  const [accounts, categories, txs] = await Promise.all([
    repos.accounts.listByUser(userId),
    repos.categories.list(userId),
    repos.transactions.findManyInRange(userId, from, to),
  ]);
  return { tz, accounts, categories, txs };
}

/**
 * Resumo de UM mês a partir de dados já carregados. Regra de ouro: transferência interna não é gasto nem renda.
 * `data.txs` precisa cobrir [início do mês, max(fim do mês, agora + 1 ms)): o que vem depois do mês só serve pra desfazer
 * o saldo de meses passados.
 */
export function summarizeMonth(data: FinanceSnapshot, month: string, now: Date) {
  const { tz, accounts, categories } = data;
  const { from, to } = monthRange(month, tz);
  const isPastMonth = month < currentMonth(now, tz) && to <= now;
  const txs = sliceRange(data.txs, from, to);
  const afterTxs = isPastMonth ? sliceRange(data.txs, to, new Date(now.getTime() + 1)) : [];
  // Conta oculta (ex.: poupança parada) some do saldo e das contas, junto com o que passa nela.
  const hiddenIds = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
  const visible = accounts.filter((a) => !a.hidden);
  const real = txs.filter((t) => !t.isInternalTransfer && !(t.accountId && hiddenIds.has(t.accountId)));

  const incomeInCents = real.filter((t) => t.amountInCents > 0).reduce((s, t) => s + t.amountInCents, 0);
  const outs = real.filter((t) => t.amountInCents < 0);
  const outcomeInCents = outs.reduce((s, t) => s - t.amountInCents, 0);

  const totals = new Map<string | null, number>();
  for (const t of outs) totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) - t.amountInCents);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const byCategory = [...totals.entries()]
    .map(([categoryId, totalInCents]) => ({
      categoryId,
      name: categoryId ? (byId.get(categoryId)?.name ?? categoryId) : 'Sem categoria',
      color: categoryId ? (byId.get(categoryId)?.color ?? '#F6EFE4') : '#F6EFE4',
      totalInCents,
    }))
    .sort((a, b) => b.totalInCents - a.totalInCents);

  // Saldo = soma das contas correntes. Em meses passados, desfaz as movimentações posteriores na conta BANK.
  const bankAccounts = visible.filter((a) => a.type === 'BANK');
  const bankIds = new Set(bankAccounts.map((a) => a.id));
  const deltaAfterByAccount = new Map<string, number>();
  if (isPastMonth && bankIds.size > 0) {
    // Só desfaz o que o saldo de verdade já incorporou: numa conta conectada (Pluggy/arquivo) é o movimento do banco
    // (external_id); numa conta MANUAL o saldo é mantido pelo próprio app a cada lançamento, então desfaz os lançamentos dela.
    // Anotação à mão ligada a conta conectada nunca entrou no saldo do banco: desfazê-la distorceria o histórico.
    const manualIds = new Set(accounts.filter((a) => a.externalId.startsWith(MANUAL_PREFIX)).map((a) => a.id));
    for (const t of afterTxs) {
      if (!t.accountId || !bankIds.has(t.accountId)) continue;
      if (t.externalId === null && !manualIds.has(t.accountId)) continue;
      deltaAfterByAccount.set(t.accountId, (deltaAfterByAccount.get(t.accountId) ?? 0) + t.amountInCents);
    }
  }
  const balanceAtMonthEnd = (accountId: string, currentBalance: number, type: string) =>
    type === 'BANK' && isPastMonth ? currentBalance - (deltaAfterByAccount.get(accountId) ?? 0) : currentBalance;

  return {
    month,
    balanceInCents: bankAccounts.length
      ? bankAccounts.reduce((s, a) => s + balanceAtMonthEnd(a.id, a.balanceInCents, a.type), 0)
      : null,
    incomeInCents,
    outcomeInCents,
    uncategorizedCount: real.filter((t) => t.categoryId === null).length,
    byCategory,
    accounts: visible.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type === 'CREDIT' ? ('CREDIT' as const) : ('BANK' as const),
      balanceInCents: balanceAtMonthEnd(a.id, a.balanceInCents, a.type),
      creditLimitInCents: a.creditLimitInCents ?? null,
      dueDate: a.dueDate ? nextDueDate(a.dueDate, now, tz).toISOString() : null,
      ...cardIdentity(a.fingerprint),
    })),
    hiddenAccounts: accounts
      .filter((a) => a.hidden)
      .map((a) => ({ id: a.id, name: a.name, balanceInCents: a.balanceInCents })),
  };
}

export type MonthSummary = ReturnType<typeof summarizeMonth>;

/** Vários meses de uma vez, sem ir ao banco: `data.txs` tem que cobrir o intervalo de todos eles. */
export function summarizeMonths(data: FinanceSnapshot, months: string[], now: Date): MonthSummary[] {
  return months.map((m) => summarizeMonth(data, m, now));
}

/**
 * Janela de lançamentos que `summarizeMonth` precisa pra esses meses: do começo do mais antigo até o fim do mais novo
 * (ou até agora + 1 ms, se algum for passado, pra desfazer o saldo).
 */
export function summaryWindow(months: string[], now: Date, tz: string) {
  const sorted = [...months].sort();
  const from = monthRange(sorted[0]!, tz).from;
  const lastEnd = monthRange(sorted[sorted.length - 1]!, tz).to;
  const nowEnd = new Date(now.getTime() + 1);
  return { from, to: lastEnd > nowEnd ? lastEnd : nowEnd };
}

/**
 * A Pluggy às vezes manda o vencimento da fatura anterior (já passou).
 * Cartão vence todo mês no mesmo dia, então empurra mês a mês até chegar em hoje ou depois.
 */
export function nextDueDate(due: Date, now: Date, tz?: string) {
  // "Hoje" é o dia civil da PESSOA (não o dia UTC: depois das 21h de Brasília o UTC já virou). O vencimento é uma
  // data de calendário guardada como meia-noite UTC; só os campos UTC dele importam.
  const p = civilParts(now, tz);
  const today = new Date(Date.UTC(p.year, p.month - 1, p.day));
  let d = new Date(due);
  for (let i = 0; i < 24 && d < today; i++) {
    const day = due.getUTCDate();
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes()));
    const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, last));
    d = next;
  }
  return d;
}
