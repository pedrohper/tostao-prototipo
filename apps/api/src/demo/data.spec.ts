// Os dados de demonstração precisam encher as telas em QUALQUER dia em que os prints forem tirados.
import { describe, expect, it } from 'vitest';
import type { Transaction } from '../domain/entities.js';
import { DEFAULT_CATEGORIES } from '../lib/defaults.js';
import { civilDay, civilMonth } from '../lib/tz.js';
import { detectSubscriptions } from '../services/subscriptions.js';
import { pendingInstallments } from '../use-cases/financial-plan.js';
import { buildDemoAccounts, buildDemoActivities, buildDemoPlan, buildDemoTransactions } from './data.js';

const TZ = 'America/Sao_Paulo';
const asDomain = (now: Date): Transaction[] =>
  buildDemoTransactions(now, TZ).map((t, i) => ({
    id: String(i),
    userId: 'u',
    accountId: t.account,
    externalId: t.manual ? null : `demo:${i}`,
    description: t.description,
    amountInCents: t.amountInCents,
    occurredAt: t.occurredAt,
    categoryId: t.categoryId,
    isInternalTransfer: t.isInternalTransfer ?? false,
    createdAt: t.occurredAt,
  }));

// Dia 1, meio, véspera de virar o mês, fim de fevereiro e a primeira hora do dia.
const DAYS = [
  '2026-11-01T09:00:00-03:00',
  '2026-11-24T22:43:00-03:00',
  '2026-12-31T23:30:00-03:00',
  '2027-02-28T00:30:00-03:00',
  '2027-01-12T12:00:00-03:00',
];

describe.each(DAYS)('demonstração em %s', (iso) => {
  const now = new Date(iso);
  const month = civilMonth(now, TZ);
  const txs = buildDemoTransactions(now, TZ);
  const thisMonth = txs.filter((t) => civilMonth(t.occurredAt, TZ) === month);

  it('só usa categorias do sistema', () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const t of txs) if (t.categoryId) expect(ids).toContain(t.categoryId);
  });

  it('só o que está pendente pode estar no futuro', () => {
    const today = civilDay(now, TZ);
    for (const t of txs.filter((t) => !t.pending)) expect(civilDay(t.occurredAt, TZ) <= today).toBe(true);
  });

  it('o mês atual tem gasto por categoria, sem categoria, a pagar, a receber e acertos dos dois lados', () => {
    expect(thisMonth.filter((t) => t.amountInCents < 0 && t.categoryId).length).toBeGreaterThan(10);
    expect(thisMonth.filter((t) => !t.categoryId && !t.isInternalTransfer).length).toBeGreaterThanOrEqual(3);
    expect(thisMonth.some((t) => t.pending && t.amountInCents < 0)).toBe(true);
    expect(thisMonth.some((t) => t.pending && t.amountInCents > 0)).toBe(true);
    const balance = (person: string) => txs.filter((t) => t.person === person).reduce((s, t) => s - t.amountInCents, 0);
    expect(balance('lari')).toBeGreaterThan(0);
    expect(balance('gui')).toBeGreaterThan(0);
    expect(balance('rafa')).toBeLessThan(0);
  });

  it('tem pelo menos 6 meses de histórico', () => {
    expect(new Set(txs.map((t) => civilMonth(t.occurredAt, TZ))).size).toBeGreaterThanOrEqual(6);
  });

  it('o detector acha só as 5 assinaturas de verdade, todas ativas, com a Netflix mais cara na última cobrança', () => {
    // Compra do dia a dia confundida com assinatura encheria /assinaturas, a previsão e os avisos de aumento.
    const found = detectSubscriptions(asDomain(now), now, TZ);
    expect(found.map((s) => s.name.split(' ')[0]!.toUpperCase().replace(/\W.*$/, '')).sort()).toEqual([
      'AMAZONPRIME',
      'APPLE',
      'NETFLIX',
      'SMARTFIT',
      'SPOTIFY',
    ]);
    expect(found.every((s) => s.active)).toBe(true);
    expect(found.find((s) => s.key.startsWith('NETFLIX'))?.amountInCents).toBe(5590);
    expect(found.filter((s) => s.amountInCents !== 5590).every((s) => s.chargeCount >= 6)).toBe(true);
  });

  it('tem parcela de cartão pela frente', () => {
    expect(pendingInstallments(asDomain(now), new Set(['cartao']), TZ).length).toBeGreaterThan(0);
  });

  it('fatura do cartão vence no futuro, plano com duas metas e ofensiva viva', () => {
    const card = buildDemoAccounts(now, TZ).find((a) => a.type === 'CREDIT')!;
    expect(card.dueDate!.getTime()).toBeGreaterThan(now.getTime());
    expect(buildDemoPlan(now, TZ).goals).toHaveLength(2);
    expect(buildDemoActivities(now, TZ).some((a) => a.day === civilDay(now, TZ))).toBe(true);
  });
});
