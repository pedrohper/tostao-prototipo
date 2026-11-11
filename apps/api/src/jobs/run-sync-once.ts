// pnpm sync: roda a sincronização na hora, sem esperar o cron.
import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { makeBankGateway } from '../gateways/make-bank-gateway.js';
import { SyncBankConnectionUseCase } from '../use-cases/sync-bank-connection.js';
import { syncAllConnections } from './daily-sync.js';

const repos = makePrismaRepositories(prisma);
const n = await syncAllConnections(repos, new SyncBankConnectionUseCase({ ...repos, bank: makeBankGateway(env) }));
console.log(`Pronto: ${n} conexões sincronizadas.`);
await prisma.$disconnect();
