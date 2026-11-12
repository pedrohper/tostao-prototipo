// Uma vez só: transações de banco gravadas como meia-noite UTC (dia sem hora) apareciam no dia anterior.
// Passa pra meio-dia de Brasília do mesmo dia, igual o sync faz agora.
import { prisma } from '../lib/prisma.js';

const fixed = await prisma.$executeRaw`
  UPDATE transactions
  SET occurred_at = occurred_at + interval '15 hours'
  WHERE account_id IS NOT NULL AND occurred_at = date_trunc('day', occurred_at)`;
console.log(`Pronto: ${fixed} transações com a data corrigida.`);
await prisma.$disconnect();
