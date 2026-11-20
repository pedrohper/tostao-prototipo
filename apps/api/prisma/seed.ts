// pnpm db:seed: cria as categorias e regras padrão. Pode rodar quantas vezes quiser.
import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../src/lib/defaults.js';

const prisma = new PrismaClient();

// Tudo numa transação: se algo falhar no meio, o banco não fica sem as regras do sistema (apagadas e não recriadas).
await prisma.$transaction(async (tx) => {
  for (const c of DEFAULT_CATEGORIES) {
    await tx.category.upsert({ where: { id: c.id }, create: c, update: c });
  }
  // Regras do sistema têm userId null; recriamos todas pra refletir o arquivo.
  await tx.categoryRule.deleteMany({ where: { userId: null } });
  await tx.categoryRule.createMany({ data: DEFAULT_RULES.map((r) => ({ ...r, userId: null })) });
});

console.log(`🌱 ${DEFAULT_CATEGORIES.length} categorias e ${DEFAULT_RULES.length} regras.`);
await prisma.$disconnect();
