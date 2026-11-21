// Monta o servidor sem ligar ele. Assim os testes usam app.inject() sem abrir porta.
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import type { Writable } from 'node:stream';
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
import { registerN8nRoute, whatsappRoutes } from './http/controllers/whatsapp.js';
import { DisabledAudioTranscriber, FakeWhatsAppGateway, type AudioTranscriber } from './gateways/whatsapp-gateway.js';
import { engagementRoutes } from './http/controllers/engagement.js';
import { investRoutes } from './http/controllers/invest.js';
import { tostaoAutoRoutes } from './http/controllers/tostao-auto.js';
import { ReferenceRatesGateway, type RatesGateway } from './gateways/rates-gateway.js';
import { DisabledPushGateway, type PushGateway } from './gateways/push-gateway.js';
import { DisabledOAuthGateway } from './gateways/oauth-gateway.js';
import { FakeEmailGateway, type EmailGateway } from './gateways/email-gateway.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '@tostao/contracts';
import { makeLimiters } from './http/rate-limits.js';
import { OAuthStateStore } from './services/oauth-state.js';
import { RedisKeyValueStore, testOnlyKeyValueStore, type KeyValueStore } from './lib/redis.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Registra POST /whatsapp/n8n numa instância isolada (a ponte do n8n). */
    registerN8nRoute(instance: FastifyInstance): void;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: { sub: string };
  }
}

/** Corpo máximo de qualquer rota. POST /imports sobe pra 5 MiB por conta própria (extratos). */
export const BODY_LIMIT_BYTES = 256 * 1024;

/** O que o log nunca pode mostrar: credenciais, tokens e segredos (cabeçalhos e campos aninhados). */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-tostao-secret"]',
  'req.headers.cookie',
  '*.password',
  '*.token',
  '*.refreshToken',
  '*.apiKey',
];

/** WEB_ORIGIN aceita uma lista separada por vírgula (ex.: o site e um domínio de preview). */
export function parseOrigins(webOrigin: string): string[] {
  return webOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export const JWT_ISSUER = 'tostao-api';
export const JWT_AUDIENCE = 'tostao-web';

/** O Node derruba socket sem tráfego por esse tempo. O SSE do chat manda heartbeat bem antes (ver SSE_HEARTBEAT_MS). */
export const CONNECTION_TIMEOUT_MS = 10_000;

type Options = Omit<Deps, 'appUrl'> & {
  jwtSecret: string;
  webOrigin: string;
  logger?: boolean;
  /** Só testes: pra onde o log vai (confere se os segredos saem censurados). */
  logStream?: Writable;
  /** Quais proxies são de confiança pra ler X-Forwarded-For (ver TRUST_PROXY). Padrão: só o próprio servidor (loopback). */
  trustProxy?: boolean | string | string[];
  whatsappVerifyToken?: string;
  n8nWhatsAppSecret?: string;
  audioTranscriber?: AudioTranscriber;
  push?: PushGateway;
  rates?: RatesGateway;
  /** E-mail transacional. Sem isso, FakeEmailGateway (memória). O server.ts passa o Resend em produção. */
  email?: EmailGateway;
  /** Redis em produção. Sem isso, só memória e só com NODE_ENV=test. */
  kv?: KeyValueStore;
};

export async function buildApp({
  repos,
  bank,
  ai,
  whatsapp = new FakeWhatsAppGateway(),
  oauth = new DisabledOAuthGateway(),
  whatsappVerifyToken = '',
  n8nWhatsAppSecret = '',
  audioTranscriber = new DisabledAudioTranscriber(),
  chatDailyLimit,
  jwtSecret,
  webOrigin,
  logger = false,
  logStream,
  trustProxy = 'loopback',
  push = new DisabledPushGateway(),
  rates = new ReferenceRatesGateway(),
  email = new FakeEmailGateway(),
  kv = testOnlyKeyValueStore(),
}: Options) {
  const app = Fastify({
    logger: logger
      ? { redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' }, ...(logStream ? { stream: logStream } : {}) }
      : false,
    trustProxy,
    bodyLimit: BODY_LIMIT_BYTES,
    requestTimeout: 30_000, // tempo máximo pra RECEBER o pedido inteiro (não limita o processamento)
    connectionTimeout: CONNECTION_TIMEOUT_MS,
  });

  // Cabeçalhos de segurança. A API só fala JSON: nada dela deve ser carregado como página, script ou moldura.
  await app.register(helmet, {
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] } },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    // HSTS só em produção (a API fala HTTP com a web na mesma máquina; quem expõe HTTPS é o proxy da frente).
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15_552_000, includeSubDomains: true } : false,
  });
  // Resposta com dado da pessoa nunca fica em cache (navegador, proxy ou CDN).
  app.addHook('onSend', async (request, reply) => {
    if (request.url !== '/health') reply.header('cache-control', 'no-store, private');
  });

  // CORS explícito: o navegador não fala direto com a API (passa pelo Next), então só as origens do site entram.
  const origins = parseOrigins(webOrigin);
  await app.register(cors, {
    origin: origins.includes('*') ? true : origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
    credentials: true,
    maxAge: 600,
  });

  // Limite de requisições: Redis em produção (contadores compartilhados e que sobrevivem a restart); memória em teste.
  await app.register(rateLimit, {
    global: false,
    nameSpace: 'tostao:rl:',
    skipOnError: true,
    ...(kv instanceof RedisKeyValueStore ? { redis: kv.client } : {}),
  });
  const limits = makeLimiters(app);
  app.addHook('preHandler', async (request, reply) => {
    if (request.url !== '/health') await limits.global(request, reply);
  });

  // Access token curto (15 min). A sessão longa vive no refresh token, que é revogável (use-cases/sessions.ts).
  // Algoritmo, emissor e público travados: um token de outro sistema/algoritmo nunca passa.
  await app.register(jwt, {
    secret: jwtSecret,
    sign: { expiresIn: ACCESS_TOKEN_TTL_SECONDS, algorithm: 'HS256', iss: JWT_ISSUER, aud: JWT_AUDIENCE },
    verify: {
      algorithms: ['HS256'],
      allowedIss: JWT_ISSUER,
      allowedAud: JWT_AUDIENCE,
      // Sem isso um token SEM iss/aud passaria: o fast-jwt só confere o que está presente.
      requiredClaims: ['iss', 'aud', 'exp', 'sub'],
    },
  });
  app.setErrorHandler(errorHandler);

  const uc = makeUseCases({ repos, bank, ai, whatsapp, oauth, kv, chatDailyLimit, email, appUrl: webOrigin });
  app.get('/health', async () => ({ ok: true }));
  engagementRoutes(app, uc, repos, push, limits);
  authRoutes(app, uc, limits, oauth, webOrigin, new OAuthStateStore(kv));
  accountRoutes(app, uc, limits);
  bankRoutes(app, uc, repos, limits);
  transactionRoutes(app, uc, limits);
  peopleRoutes(app, uc);
  planningRoutes(app, uc);
  gamesRoutes(app, uc);
  chatRoutes(app, uc);
  whatsappRoutes(app, uc, whatsapp, whatsappVerifyToken, audioTranscriber, limits);
  // Entrega o handler do n8n à ponte isolada (http/n8n-bridge.ts); no app principal essa rota não existe.
  app.decorate('registerN8nRoute', (instance: FastifyInstance) => registerN8nRoute(instance, uc, n8nWhatsAppSecret));
  tostaoAutoRoutes(app, uc, limits);
  investRoutes(app, rates);
  return app;
}
