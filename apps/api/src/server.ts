import { env } from './env.js';
import { buildApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { makePrismaRepositories } from './repositories/prisma/index.js';
import { makeBankGateway } from './gateways/make-bank-gateway.js';
import { SyncBankConnectionUseCase } from './use-cases/sync-bank-connection.js';
import { scheduleDailySync, syncAllConnections } from './jobs/daily-sync.js';

const repos = makePrismaRepositories(prisma);
const bank = makeBankGateway(env);
const app = await buildApp({ repos, bank, jwtSecret: env.JWT_SECRET, webOrigin: env.WEB_ORIGIN, logger: true });

const sync = new SyncBankConnectionUseCase({ ...repos, bank });
scheduleDailySync(env.SYNC_CRON, () => syncAllConnections(repos, sync));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`🪙 Tostão API em http://localhost:${env.PORT} (banco: ${env.BANK_GATEWAY})`);
