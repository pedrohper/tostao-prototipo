// Monta o servidor sem ligar ele. Assim os testes usam app.inject() sem abrir porta.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { makeUseCases, type Deps } from './use-cases/factories.js';
import { errorHandler } from './http/error-handler.js';
import { authRoutes } from './http/controllers/auth.js';
import { accountRoutes } from './http/controllers/account.js';
import { bankRoutes } from './http/controllers/bank.js';
import { peopleRoutes } from './http/controllers/people.js';
import { transactionRoutes } from './http/controllers/transactions.js';
import { planningRoutes } from './http/controllers/planning.js';
import { gamesRoutes } from './http/controllers/games.js';
import { chatRoutes } from './http/controllers/chat.js';
import { whatsappRoutes } from './http/controllers/whatsapp.js';
import { FakeWhatsAppGateway } from './gateways/whatsapp-gateway.js';
import { engagementRoutes } from './http/controllers/engagement.js';
import { investRoutes } from './http/controllers/invest.js';
import { ReferenceRatesGateway, type RatesGateway } from './gateways/rates-gateway.js';
import { DisabledPushGateway, type PushGateway } from './gateways/push-gateway.js';

declare module '@fastify/jwt' {
  interface FastifyJWT { user: { sub: string } }
}

type Options = Deps & { jwtSecret: string; webOrigin: string; logger?: boolean; whatsappVerifyToken?: string; n8nWhatsAppSecret?: string; push?: PushGateway; rates?: RatesGateway };

export async function buildApp({ repos, bank, ai, whatsapp = new FakeWhatsAppGateway(), whatsappVerifyToken = '', n8nWhatsAppSecret = '', chatDailyLimit, jwtSecret, webOrigin, logger = false, push = new DisabledPushGateway(), rates = new ReferenceRatesGateway() }: Options) {
  const app = Fastify({ logger });
  await app.register(cors, { origin: webOrigin });
  await app.register(jwt, { secret: jwtSecret, sign: { expiresIn: '7d' } });
  app.setErrorHandler(errorHandler);

  const uc = makeUseCases({ repos, bank, ai, whatsapp, chatDailyLimit });
  app.get('/health', async () => ({ ok: true }));
  engagementRoutes(app, uc, repos, push);
  authRoutes(app, uc);
  accountRoutes(app, uc);
  bankRoutes(app, uc, repos);
  transactionRoutes(app, uc);
  peopleRoutes(app, uc);
  planningRoutes(app, uc);
  gamesRoutes(app, uc);
  chatRoutes(app, uc);
  whatsappRoutes(app, uc, whatsapp, whatsappVerifyToken, n8nWhatsAppSecret);
  investRoutes(app, rates);
  return app;
}
