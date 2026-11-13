// pnpm recompute-transfers: reaplica as regras de categoria (nas sem categoria) e a de transferência interna
// em TODO o histórico. O sync só olha os últimos dias; rode isto quando uma regra mudar.
import { prisma } from '../lib/prisma.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { detectInternalTransfers } from '../services/internal-transfers.js';
import { categorizeByRules } from '../services/categorize.js';

const repos = makePrismaRepositories(prisma);
const users = await prisma.user.findMany({ select: { id: true } });
let changed = 0;
for (const { id } of users) {
  const all = await repos.transactions.findManyInRange(id, new Date(0), new Date(Date.now() + 24 * 60 * 60 * 1000));
  const rules = await repos.rules.listForUser(id);
  for (const [i, t] of all.entries()) {
    if (t.categoryId) continue;
    const categoryId = categorizeByRules(t.description, rules);
    if (!categoryId) continue;
    all[i] = { ...t, categoryId };
    await repos.transactions.save(all[i]!);
    console.log(`${t.occurredAt.toISOString().slice(0, 10)}  ${(t.amountInCents / 100).toFixed(2)}  ${t.description}  -> categoria ${categoryId}`);
    changed++;
  }
  const internal = detectInternalTransfers(all);
  for (const t of all) {
    const shouldBe = internal.has(t.id);
    if (t.accountId && t.isInternalTransfer !== shouldBe) {
      await repos.transactions.save({ ...t, isInternalTransfer: shouldBe });
      console.log(`${t.occurredAt.toISOString().slice(0, 10)}  ${(t.amountInCents / 100).toFixed(2)}  ${t.description}  -> ${shouldBe ? 'interna' : 'gasto/renda'}`);
      changed++;
    }
  }
}
console.log(`Pronto: ${changed} transações reclassificadas.`);
await prisma.$disconnect();
