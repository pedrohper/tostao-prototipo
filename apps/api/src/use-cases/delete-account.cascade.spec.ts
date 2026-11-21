// Teste de integração contra Postgres REAL: a cascata de exclusão é regra de banco (FK), o repositório em
// memória não consegue provar nada aqui. Só roda com TEST_DATABASE_URL (um banco descartável, NUNCA o de
// produção); sem ela, fica como "skipped" e o `pnpm test` segue sem depender de Postgres.
//   docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tostao_test -p 127.0.0.1:55432:5432 postgres:16
//   DATABASE_URL=<url> pnpm --filter @tostao/api db:deploy
//   TEST_DATABASE_URL=<url> pnpm --filter @tostao/api test delete-account.cascade
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { DeleteAccountUseCase } from './delete-account.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Apagar conta: cascata no Postgres real', () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  async function seedUser(email: string) {
    const user = await db.user.create({
      data: { name: 'Pessoa', email, passwordHash: await bcrypt.hash('12345678', 4) },
    });
    const category = await db.category.create({
      data: { id: `pets-${user.id}`, name: 'Pets', emoji: '🐶', color: '#FF5A36', kind: 'saida', userId: user.id },
    });
    const rule = await db.categoryRule.create({
      data: { userId: user.id, pattern: 'PETZ', categoryId: category.id },
    });
    const budget = await db.categoryBudget.create({
      data: { userId: user.id, categoryId: category.id, limitInCents: 30000 },
    });
    const tx = await db.transaction.create({
      data: {
        userId: user.id,
        description: 'PETZ LOJA 12',
        amountInCents: -8990,
        occurredAt: new Date('2026-11-10T12:00:00Z'),
        categoryId: category.id,
      },
    });
    return { user, category, rule, budget, tx };
  }

  it('usuário com categoria customizada + regra + orçamento nela é apagado sem erro 23503', async () => {
    const a = await seedUser('cascata-a@teste.local');
    const b = await seedUser('cascata-b@teste.local'); // não pode ser tocado
    const useCase = new DeleteAccountUseCase(makePrismaRepositories(db), new FakeBankGateway());

    const result = await useCase.execute({ userId: a.user.id, password: '12345678' });

    expect(result).toEqual({ providerFailures: 0 });
    expect(await db.user.findUnique({ where: { id: a.user.id } })).toBeNull();
    expect(await db.category.findUnique({ where: { id: a.category.id } })).toBeNull();
    expect(await db.categoryRule.findUnique({ where: { id: a.rule.id } })).toBeNull();
    expect(await db.categoryBudget.findUnique({ where: { id: a.budget.id } })).toBeNull();
    expect(await db.transaction.findUnique({ where: { id: a.tx.id } })).toBeNull();

    // O outro usuário continua inteiro.
    expect(await db.user.findUnique({ where: { id: b.user.id } })).not.toBeNull();
    expect(await db.category.findUnique({ where: { id: b.category.id } })).not.toBeNull();
    expect(await db.categoryRule.findUnique({ where: { id: b.rule.id } })).not.toBeNull();
    expect(await db.categoryBudget.findUnique({ where: { id: b.budget.id } })).not.toBeNull();
    await db.user.delete({ where: { id: b.user.id } });
  });

  it('apagar só a categoria também leva a regra e o orçamento dela (sem 23503)', async () => {
    const a = await seedUser('cascata-c@teste.local');
    await db.category.delete({ where: { id: a.category.id } });
    expect(await db.categoryRule.findUnique({ where: { id: a.rule.id } })).toBeNull();
    expect(await db.categoryBudget.findUnique({ where: { id: a.budget.id } })).toBeNull();
    // A transação continua, só fica sem categoria (SetNull).
    expect((await db.transaction.findUnique({ where: { id: a.tx.id } }))?.categoryId).toBeNull();
    await db.user.delete({ where: { id: a.user.id } });
  });
});
