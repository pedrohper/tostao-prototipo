import { env } from './env.js';
import { buildApp } from './app.js';
import { DeepSeekGateway, FakeAiGateway } from './gateways/ai-gateway.js';
import { CloudApiWhatsAppGateway, FakeWhatsAppGateway } from './gateways/whatsapp-gateway.js';
import { prisma } from './lib/prisma.js';
import { makePrismaRepositories } from './repositories/prisma/index.js';
import { makeBankGateway } from './gateways/make-bank-gateway.js';
import { SyncBankConnectionUseCase } from './use-cases/sync-bank-connection.js';
import { AutoCategorizeUseCase } from './use-cases/auto-categorize.js';
import { scheduleDailySync, syncAllConnections } from './jobs/daily-sync.js';

const repos = makePrismaRepositories(prisma);
const bank = makeBankGateway(env);
const ai = env.DEEPSEEK_API_KEY ? new DeepSeekGateway(env.DEEPSEEK_API_KEY, env.DEEPSEEK_MODEL) : new FakeAiGateway();
const whatsapp = env.WHATSAPP_TOKEN
  ? new CloudApiWhatsAppGateway(env.WHATSAPP_TOKEN, env.WHATSAPP_PHONE_NUMBER_ID, env.WHATSAPP_APP_SECRET, env.WHATSAPP_NUMBER || null)
  : new FakeWhatsAppGateway();
const app = await buildApp({ repos, bank, ai, whatsapp, whatsappVerifyToken: env.WHATSAPP_VERIFY_TOKEN, chatDailyLimit: env.CHAT_DAILY_LIMIT, jwtSecret: env.JWT_SECRET, webOrigin: env.WEB_ORIGIN, logger: true });

const sync = new SyncBankConnectionUseCase({ ...repos, bank });
const autoCategorize = new AutoCategorizeUseCase(repos, ai);
scheduleDailySync(env.SYNC_CRON, async () => {
  await syncAllConnections(repos, sync);
  const users = new Set((await repos.connections.listActive()).map((c) => c.userId));
  for (const userId of users) {
    try {
      const r = await autoCategorize.execute({ userId });
      if (r.categorized) console.info(`[ia] ${r.categorized} de ${r.asked} categorizadas`);
    } catch (err) {
      console.error('[ia] categoria automática falhou:', (err as Error).message);
    }
  }
});

await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`🪙 Tostão API em http://localhost:${env.PORT} (banco: ${env.BANK_GATEWAY}, IA: ${ai.enabled ? 'DeepSeek' : 'desligada'}, WhatsApp: ${whatsapp.enabled ? 'ligado' : 'desligado'})`);
