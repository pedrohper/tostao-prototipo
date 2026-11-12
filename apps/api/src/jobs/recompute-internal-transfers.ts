// pnpm recompute-transfers: reaplica a regra de transferência interna em TODO o histórico.
// O sync só olha os últimos dias; rode isto quando a regra mudar.
import { prisma } from '../lib/prisma.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { detectInternalTransfers } from '../services/internal-transfers.js';

const repos = makePrismaRepositories(prisma);
const users = await prisma.user.findMany({ select: { id: true } });
let changed = 0;
for (const { id } of users) {
  const all = await repos.transactions.findManyInRange(id, new Date(0), new Date(Date.now() + 24 * 60 * 60 * 1000));
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
