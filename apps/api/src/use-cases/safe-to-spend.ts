import type { SafeToSpendBreakdown } from '@tostao/contracts';
import type { RecurringRule, Transaction } from '../domain/entities.js';
import { normalizeDescription } from '../lib/text.js';
import { civilDay, civilDayOfMonth } from '../lib/tz.js';
import { occurrencesInMonth } from '../services/recurrence.js';
import { installmentOf, subscriptionKey, type Subscription } from '../services/subscriptions.js';
import { isNeutral } from './categories.js';

/**
 * T6.17 · "Quanto posso gastar hoje":
 *   (renda − já gasto − fixos que faltam − assinaturas que faltam − o que mais está marcado − meta do mês)
 *   ÷ dias que faltam, contando hoje.
 * "Já gasto" são todas as saídas do mês (inclusive as anotadas com data futura); o resto é o que AINDA vai sair e não
 * está nelas. A mesma conta pode aparecer em mais de uma lista (aluguel nas contas fixas e numa recorrência, Netflix
 * fixa e detectada): ela é descontada uma vez só.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Ciclo maior que isto é "uma vez por mês": quem já cobrou neste mês só cobra de novo no próximo. */
const SHORT_CYCLE_DAYS = 28;
/** Sem nome em comum, só um valor idêntico a partir daqui prova que um lançamento pagou a conta fixa. */
const SAME_VALUE_PROOF_CENTS = 200_00;
/** Quantos dias antes do vencimento um pagamento de valor idêntico ainda vale pra essa conta. */
const EARLY_PAYMENT_DAYS = 5;

type Bill = { name: string; cents: number; day: number | null };
type Fixed = { name: string; amountInCents: number; day: number };
type Installment = { description: string; accountId: string; n: number; total: number; amount: number };

const GENERIC_WORDS = new Set(
  'CONTA CONTAS PAGAMENTO PAGTO PAG PIX COMPRA DEBITO CREDITO MENSALIDADE PARCELA PARC PLANO ENVIADO PARA DOS DAS'.split(
    ' ',
  ),
);
const words = (text: string) =>
  subscriptionKey(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
const shareName = (a: string, b: string) => {
  const other = new Set(words(b));
  return words(a).some((w) => other.has(w));
};
const within = (a: number, b: number, percent: number) => Math.abs(a - b) * 100 <= Math.max(a, b) * percent;

/** Duas linhas de "ainda vai sair" são a mesma conta? */
const sameBill = (a: Bill, b: Bill) =>
  (shareName(a.name, b.name) && within(a.cents, b.cents, 25)) ||
  (a.cents === b.cents && a.day !== null && b.day !== null && Math.abs(a.day - b.day) <= 3);

/**
 * Separa o primeiro lançamento (ainda não usado) que paga a conta. Exigente de propósito: achar pagamento que não
 * existe faria o número prometer dinheiro que já tem dono.
 */
function takePayment(bill: Bill, payments: { cents: number; day: number; description: string }[]) {
  const index = payments.findIndex(
    (p) =>
      (shareName(bill.name, p.description) && within(bill.cents, p.cents, 15)) ||
      (bill.day !== null &&
        bill.cents >= SAME_VALUE_PROOF_CENTS &&
        p.cents === bill.cents &&
        p.day <= bill.day &&
        p.day >= bill.day - EARLY_PAYMENT_DAYS),
  );
  if (index < 0) return false;
  payments.splice(index, 1);
  return true;
}

export function safeToSpend({
  now,
  tz,
  monthEnd,
  daysInMonth,
  incomeInCents,
  spentInCents,
  goalInCents,
  monthOutflows,
  fixedExpenses,
  subscriptions,
  installments,
  rules,
  hiddenAccountIds,
}: {
  now: Date;
  tz: string;
  /** Primeiro instante do mês seguinte, no fuso da pessoa. */
  monthEnd: Date;
  daysInMonth: number;
  incomeInCents: number;
  spentInCents: number;
  /** Quanto deste mês é da(s) meta(s): o que falta separar ou o que já foi separado. */
  goalInCents: number;
  /** Saídas do mês que contam como gasto (as mesmas de `spentInCents`). */
  monthOutflows: Transaction[];
  fixedExpenses: Fixed[];
  subscriptions: Subscription[];
  /** Parcelas de compras antigas que caem neste mês e ainda não apareceram no cartão. */
  installments: Installment[];
  rules: RecurringRule[];
  hiddenAccountIds: Set<string>;
}): { safeToSpendTodayInCents: number; safeToSpend: SafeToSpendBreakdown } {
  const today = civilDayOfMonth(now, tz);
  const month = civilDay(now, tz).slice(0, 7);
  const payments = monthOutflows.map((t) => ({
    cents: -t.amountInCents,
    day: civilDayOfMonth(t.occurredAt, tz),
    description: t.description,
  }));

  const pending: (Bill & { kind: 'fixed' | 'subscription' | 'scheduled' })[] = [];
  /** Entra na lista, a não ser que a conta já esteja lá vinda de OUTRA origem (aí fica o maior valor). */
  const add = (kind: (typeof pending)[number]['kind'], bill: Bill) => {
    const twin = pending.find((p) => p.kind !== kind && sameBill(p, bill));
    if (twin) twin.cents = Math.max(twin.cents, bill.cents);
    else pending.push({ ...bill, kind });
  };

  // Contas fixas: faltam as de hoje em diante sem pagamento visto. Dia que já passou conta como pago (está no "já gasto").
  const fixed = fixedExpenses
    .map((f) => ({ name: f.name, cents: f.amountInCents, day: Math.min(f.day, daysInMonth) }))
    .sort((a, b) => a.day - b.day);
  for (const bill of fixed) if (!takePayment(bill, payments) && bill.day >= today) add('fixed', bill);

  // Assinaturas: o que ainda deve cobrar até o fim do mês, inclusive a atrasada há poucos dias (o banco lança depois).
  for (const s of subscriptions) {
    if (!s.active || s.installmentsLeft === 0 || s.nextChargeAt >= monthEnd) continue;
    const chargedThisMonth = civilDay(s.lastChargedAt, tz).startsWith(month);
    const cycle = (s.nextChargeAt.getTime() - s.lastChargedAt.getTime()) / DAY;
    if (chargedThisMonth && cycle > SHORT_CYCLE_DAYS) continue;
    add('subscription', { name: s.name, cents: s.amountInCents, day: civilDayOfMonth(s.nextChargeAt, tz) });
  }

  // Parcelas no cartão que ainda não caíram. A mesma compra pode vir repetida (a 1ª parcela difere uns centavos).
  const seen = new Set<string>();
  for (const i of installments) {
    const id = `${i.accountId}|${subscriptionKey(i.description)}|${i.n}/${i.total}`;
    const posted = monthOutflows.some(
      (t) =>
        t.accountId === i.accountId &&
        subscriptionKey(t.description) === subscriptionKey(i.description) &&
        installmentOf(normalizeDescription(t.description))?.n === i.n,
    );
    if (posted || seen.has(id)) continue;
    seen.add(id);
    add('scheduled', { name: i.description, cents: i.amount, day: null });
  }

  // Lançamentos automáticos que ainda vão virar gasto neste mês. Os que não se lançam sozinhos seguem a regra das fixas.
  for (const rule of rules) {
    if (rule.kind !== 'saida' || !rule.active || isNeutral(rule.categoryId)) continue;
    if (rule.accountId && hiddenAccountIds.has(rule.accountId)) continue;
    for (const occurrence of occurrencesInMonth(rule, month, tz)) {
      const bill = { name: rule.description, cents: rule.amountInCents, day: Number(occurrence.day.slice(8)) };
      if (!rule.autoPost && (bill.day < today || takePayment(bill, payments))) continue;
      add('scheduled', bill);
    }
  }

  const sum = (kind: (typeof pending)[number]['kind']) =>
    pending.filter((p) => p.kind === kind).reduce((total, p) => total + p.cents, 0);
  const fixedInCents = sum('fixed');
  const subscriptionsInCents = sum('subscription');
  const scheduledInCents = sum('scheduled');
  const availableInCents =
    incomeInCents - spentInCents - fixedInCents - subscriptionsInCents - scheduledInCents - goalInCents;
  const daysIncludingToday = daysInMonth - today + 1;
  return {
    // Arredonda pra baixo (também no negativo): o número nunca promete um centavo que não existe.
    safeToSpendTodayInCents: Math.floor(availableInCents / daysIncludingToday),
    safeToSpend: {
      availableInCents,
      daysIncludingToday,
      fixedInCents,
      subscriptionsInCents,
      scheduledInCents,
      goalInCents,
    },
  };
}
