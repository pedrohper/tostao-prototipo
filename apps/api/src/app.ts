// Monta o servidor sem ligar ele. Assim os testes usam app.inject() sem abrir porta.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { makeUseCases, type Deps } from './use-cases/factories.js';
import { errorHandler } from './http/error-handler.js';
import { authRoutes } from './http/controllers/auth.js';
import { bankRoutes } from './http/controllers/bank.js';
import { transactionRoutes } from './http/controllers/transactions.js';
import { planningRoutes } from './http/controllers/planning.js';

declare module '@fastify/jwt' {
  interface FastifyJWT { user: { sub: string } }
}

type Options = Deps & { jwtSecret: string; webOrigin: string; logger?: boolean };

export async function buildApp({ repos, bank, jwtSecret, webOrigin, logger = false }: Options) {
  const app = Fastify({ logger });
  await app.register(cors, { origin: webOrigin });
  await app.register(jwt, { secret: jwtSecret, sign: { expiresIn: '7d' } });
  app.setErrorHandler(errorHandler);

  const uc = makeUseCases({ repos, bank });
  app.get('/health', async () => ({ ok: true }));
  authRoutes(app, uc);
  bankRoutes(app, uc, repos);
  transactionRoutes(app, uc);
  planningRoutes(app, uc);
  return app;
}
