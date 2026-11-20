import { env } from './env.js';
import { buildApp } from './app.js';
import { DeepSeekGateway, FakeAiGateway } from './gateways/ai-gateway.js';
import {
  CloudApiWhatsAppGateway,
  DisabledAudioTranscriber,
  FakeWhatsAppGateway,
  N8nWhatsAppGateway,
  WhisperAudioTranscriber,
} from './gateways/whatsapp-gateway.js';
import { prisma } from './lib/prisma.js';
import { makePrismaRepositories } from './repositories/prisma/index.js';
import { makeBankGateway } from './gateways/make-bank-gateway.js';
import { SyncBankConnectionUseCase } from './use-cases/sync-bank-connection.js';
import { AutoCategorizeUseCase } from './use-cases/auto-categorize.js';
import { isSyncStale, scheduleDailySync, syncAllConnections } from './jobs/daily-sync.js';
import { DisabledPushGateway, WebPushGateway } from './gateways/push-gateway.js';
import { scheduleNotifications } from './jobs/notifications.js';
import { scheduleOutbox } from './jobs/outbox.js';
import { scheduleTostaoChecks, runPeriodicTostaoChecks } from './jobs/tostao-checks.js';
import { BcbRatesGateway } from './gateways/rates-gateway.js';
import { OidcOAuthGateway } from './gateways/oauth-gateway.js';
import { makeEmailGateway } from './gateways/make-email-gateway.js';
import { createKeyValueStore } from './lib/redis.js';
import { buildN8nBridge, listenN8nBridge } from './http/n8n-bridge.js';

/** "true"/"false" viram boolean; "a,b,c" vira lista (IPs/CIDRs/palavras-chave do proxy-addr); o resto passa direto. */
function parseTrustProxy(raw: string): boolean | string | string[] {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw.includes(',')
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : raw;
}

const repos = makePrismaRepositories(prisma);
const bank = makeBankGateway(env);
const ai = env.DEEPSEEK_API_KEY ? new DeepSeekGateway(env.DEEPSEEK_API_KEY, env.DEEPSEEK_MODEL) : new FakeAiGateway();
const whatsapp = env.WHATSAPP_TOKEN
  ? new CloudApiWhatsAppGateway(
      env.WHATSAPP_TOKEN,
      env.WHATSAPP_PHONE_NUMBER_ID,
      env.WHATSAPP_APP_SECRET,
      env.WHATSAPP_NUMBER || null,
    )
  : env.N8N_WHATSAPP_SECRET
    ? new N8nWhatsAppGateway(env.N8N_WHATSAPP_SECRET, env.N8N_WHATSAPP_SEND_URL || null, env.WHATSAPP_NUMBER || null)
    : new FakeWhatsAppGateway();
const audioTranscriber = env.WHISPER_URL
  ? new WhisperAudioTranscriber(env.WHISPER_URL)
  : new DisabledAudioTranscriber();
const push =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? new WebPushGateway(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT)
    : new DisabledPushGateway();
const email = makeEmailGateway(env);
const kv = createKeyValueStore({ redisUrl: env.REDIS_URL, nodeEnv: process.env.NODE_ENV });
const oauth = new OidcOAuthGateway({
  google:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : undefined,
  apple:
    env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY
      ? {
          clientId: env.APPLE_CLIENT_ID,
          teamId: env.APPLE_TEAM_ID,
          keyId: env.APPLE_KEY_ID,
          privateKey: env.APPLE_PRIVATE_KEY,
        }
      : undefined,
});
const app = await buildApp({
  repos,
  bank,
  ai,
  whatsapp,
  oauth,
  email,
  kv,
  audioTranscriber,
  push,
  rates: new BcbRatesGateway(),
  whatsappVerifyToken: env.WHATSAPP_VERIFY_TOKEN,
  n8nWhatsAppSecret: env.N8N_WHATSAPP_SECRET,
  chatDailyLimit: env.CHAT_DAILY_LIMIT,
  jwtSecret: env.JWT_SECRET,
  webOrigin: env.WEB_ORIGIN,
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  logger: true,
});

const sync = new SyncBankConnectionUseCase({ ...repos, bank });
const autoCategorize = new AutoCategorizeUseCase(repos, ai, kv);
const syncEverything = async () => {
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
  await runPeriodicTostaoChecks(repos, { push, whatsapp }).catch((err) =>
    console.error('[tostao-auto] pós-sync falhou:', (err as Error).message),
  );
};
scheduleDailySync(env.SYNC_CRON, syncEverything);
// Subiu depois de muito tempo parado? Sincroniza já, sem esperar o próximo horário.
if (await isSyncStale(repos, 6 * 3600_000).catch(() => false)) {
  console.info('[sync] última sincronização tem mais de 6 h: rodando agora');
  void syncEverything().catch((err) => console.error('[sync] falhou:', (err as Error).message));
}

scheduleNotifications(repos, push, whatsapp);
scheduleOutbox(repos, bank);
scheduleTostaoChecks(repos, { push, whatsapp });

await app.listen({ port: env.PORT, host: env.HOST });

if (env.N8N_WHATSAPP_SECRET && env.N8N_LISTEN_HOST) {
  void listenN8nBridge(buildN8nBridge(app), env.N8N_LISTEN_HOST, env.N8N_LISTEN_PORT, (m) => console.info(m));
}
const oauthProviders = Object.entries(oauth.enabledProviders())
  .filter(([, on]) => on)
  .map(([name]) => name)
  .join(', ');
console.log(
  `🪙 Tostão API em http://localhost:${env.PORT} (banco: ${env.BANK_GATEWAY}, IA: ${ai.enabled ? 'DeepSeek' : 'desligada'}, WhatsApp: ${whatsapp.enabled ? (env.WHATSAPP_TOKEN ? 'Meta' : 'n8n') : 'desligado'}, avisos: ${push.enabled ? 'ligados' : 'desligados'}, login social: ${oauthProviders || 'desligado'})`,
);
