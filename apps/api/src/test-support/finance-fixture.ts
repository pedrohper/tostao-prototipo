// Massa de dados da T2.1: uma pessoa com banco, cartão, assinatura, parcela, acertos, plano e limite, ~230 lançamentos.
// Usada pela contagem de queries (query-count.t21.spec.ts) e por quem precisar de dados realistas contra Postgres real.
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Repositories } from '../repositories/types.js';

export const FIXTURE_NOW = new Date(Date.UTC(2026, 10, 20, 18));
const DAY = 86_400_000;
const NOW = FIXTURE_NOW;
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY);

export async function seedFinanceFixture(db: PrismaClient, repos: Pick<Repositories, 'plans'>) {
  const u = await db.user.create({
    data: { name: 'Pedro Silva', email: `q-${randomUUID()}@x.com`, passwordHash: 'x', aiConsentAt: NOW },
  });
  const userId = u.id;
  const conn = await db.bankConnection.create({ data: { userId, itemId: `item-${randomUUID()}` } });
  const bank = await db.account.create({
    data: {
      userId,
      connectionId: conn.id,
      externalId: `b-${randomUUID()}`,
      name: 'Nubank',
      type: 'BANK',
      balanceInCents: 1_500_00,
    },
  });
  const card = await db.account.create({
    data: {
      userId,
      connectionId: conn.id,
      externalId: `c-${randomUUID()}`,
      name: 'Cartão',
      type: 'CREDIT',
      balanceInCents: -800_00,
      fingerprint: 'CREDIT:VISA:1234',
      dueDate: at(-8),
    },
  });
  await db.category.createMany({
    data: [
      { id: `q-${u.id}-mercado`, name: 'Mercado', emoji: '🛒', color: '#111', kind: 'saida', userId },
      { id: `q-${u.id}-delivery`, name: 'Delivery', emoji: '🍔', color: '#222', kind: 'saida', userId },
    ],
  });
  const mercado = `q-${u.id}-mercado`;
  const delivery = `q-${u.id}-delivery`;

  const people = await Promise.all(
    ['Ana', 'Bia', 'Caio', 'Dani', 'Edu'].map((name) => db.person.create({ data: { userId, name } })),
  );
  const rows: Prisma.TransactionCreateManyInput[] = [];
  for (let d = 1; d <= 200; d++) {
    rows.push({
      userId,
      accountId: bank.id,
      externalId: `x-${userId}-${d}`,
      description: d % 3 === 0 ? 'IFD*RESTAURANTE' : d % 3 === 1 ? 'SUPERMERCADO BOM' : 'UBER *TRIP',
      amountInCents: -(10_00 + d),
      occurredAt: at(d),
      categoryId: d % 3 === 0 ? delivery : d % 3 === 1 ? mercado : null,
    });
  }
  for (let m = 0; m < 7; m++) {
    rows.push({
      userId,
      accountId: bank.id,
      externalId: `sal-${userId}-${m}`,
      description: 'SALARIO',
      amountInCents: 4000_00,
      occurredAt: at(m * 30 + 15),
    });
    rows.push({
      userId,
      accountId: card.id,
      externalId: `nf-${userId}-${m}`,
      description: 'NETFLIX.COM',
      amountInCents: -39_90,
      occurredAt: at(m * 30 + 5),
      categoryId: delivery,
    });
  }
  rows.push({
    userId,
    accountId: card.id,
    externalId: `par-${userId}`,
    description: 'GELADEIRA 3/10',
    amountInCents: -250_00,
    occurredAt: at(10),
  });
  for (const [i, p] of people.entries()) {
    for (let k = 0; k < 5; k++) {
      rows.push({
        userId,
        accountId: null,
        externalId: null,
        description: `Acerto ${p.name} ${k}`,
        amountInCents: (k % 2 ? 1 : -1) * (20_00 + i * 5),
        occurredAt: at(3 + k),
        personId: p.id,
        isInternalTransfer: true,
      });
    }
  }
  await db.transaction.createMany({ data: rows });
  await repos.plans.save(userId, {
    salary: { amountInCents: 4000_00, payday: 5, varies: false, bank: null, advance: null, pattern: null },
    otherIncomes: [],
    fixedExpenses: [{ name: 'Aluguel', amountInCents: 900_00, day: 10 }],
    benefits: [],
    goal: null,
  } as never);
  await db.categoryBudget.create({ data: { userId, categoryId: delivery, limitInCents: 300_00 } });
  return { userId: u.id };
}
