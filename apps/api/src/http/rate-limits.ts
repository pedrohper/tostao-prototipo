// Limites de requisição (anti-abuso e anti-força-bruta), com contadores no Redis (ou na memória, só em NODE_ENV=test).
// Cada limite é um preHandler que o controller pluga na rota. Roda DEPOIS do verifyJwt (por isso "por usuário" funciona)
// e depois de ler o corpo (por isso "IP + e-mail" funciona).
//
// A API fica atrás do Next: o IP que ela vê é o que a web repassa em X-Forwarded-For (ver TRUST_PROXY no env.ts).
// Sem isso todo mundo chegaria como 127.0.0.1 e o limite por IP derrubaria o site inteiro.
import { createHash } from 'node:crypto';
import { normalizeIP } from '@fastify/rate-limit';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RateLimitedError } from '../domain/errors.js';

const MINUTE = 60_000;
export const FIFTEEN_MINUTES = 15 * MINUTE;
export const ONE_DAY = 24 * 60 * MINUTE;

type Identity = (request: FastifyRequest) => string;
export type Limiter = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

const ip: Identity = (r) => normalizeIP(r.ip);
const user: Identity = (r) => r.user?.sub ?? `ip:${normalizeIP(r.ip)}`;
const ipAndEmail: Identity = (r) => {
  const email = (r.body as { email?: unknown } | null)?.email;
  return `${normalizeIP(r.ip)}|${typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : ''}`;
};
/** Por token de automação: a identidade é o hash do cabeçalho (o token em claro nunca vira chave nem log). */
const bearerHash: Identity = (r) =>
  createHash('sha256')
    .update(String(r.headers.authorization ?? ''))
    .digest('hex')
    .slice(0, 32);
const bodyEmail: Identity = (r) => {
  const email = (r.body as { email?: unknown } | null)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
};

function retryMessage(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes >= 120
    ? `Muitas tentativas. Tenta de novo daqui a ${Math.ceil(minutes / 60)} horas.`
    : `Muitas tentativas. Tenta de novo daqui a ${minutes} min.`;
}

/** Monta todos os limitadores a partir do plugin já registrado (app.createRateLimit). */
export function makeLimiters(app: FastifyInstance) {
  const make = (name: string, max: number, windowMs: number, identity: Identity): Limiter => {
    const check = app.createRateLimit({
      max,
      timeWindow: windowMs,
      keyGenerator: (r) => `${name}:${identity(r)}`,
      skipOnError: true, // Redis fora do ar: não derruba a API (o erro aparece no log do plugin)
    });
    return async (request, reply) => {
      const limit = await check(request);
      if (limit.isAllowed || !limit.isExceeded) return;
      reply.header('retry-after', String(limit.ttlInSeconds));
      throw new RateLimitedError(retryMessage(limit.ttlInSeconds));
    };
  };

  return {
    /** Teto geral de qualquer rota: 120/min por usuário (ou por IP, sem login). */
    global: make('global', 120, MINUTE, user),

    sessionsByIpEmail: make('sessions:ip-email', 10, FIFTEEN_MINUTES, ipAndEmail),
    sessionsByIp: make('sessions:ip', 30, FIFTEEN_MINUTES, ip),
    usersByIp: make('users:ip', 5, FIFTEEN_MINUTES, ip),
    passwordResetsByIp: make('password-resets:ip', 5, FIFTEEN_MINUTES, ip),
    /** Por e-mail (com conta ou sem): impede encher a caixa de entrada de alguém, sem virar oráculo de e-mails. */
    passwordResetsByEmail: make('password-resets:email', 5, FIFTEEN_MINUTES, bodyEmail),
    passwordRedeemByIp: make('password-redeem:ip', 5, FIFTEEN_MINUTES, ip),
    resendVerificationByIp: make('resend-verification:ip', 5, FIFTEEN_MINUTES, ip),
    resendVerificationByUser: make('resend-verification:user', 5, FIFTEEN_MINUTES, user),

    deleteAccountByUser: make('me-delete:user', 5, FIFTEEN_MINUTES, user),
    /** Exportação (JSON da LGPD e CSV): junta o histórico inteiro numa resposta, então só 2 por dia por pessoa. */
    exportByUser: make('me-export:user', 2, ONE_DAY, user),
    friendsByUser: make('friends:user', 10, FIFTEEN_MINUTES, user),
    /** Cadastrar, trocar ou apagar a chave Pix. */
    pixKeyByUser: make('pix-key:user', 20, FIFTEEN_MINUTES, user),
    /** "Isso é golpe?": além da cota diária da IA, 10 análises por 15 min por pessoa. */
    scamCheckByUser: make('scam-check:user', 10, FIFTEEN_MINUTES, user),
    autoCategorizeByUser: make('auto-categorize:user', 5, ONE_DAY, user),
    /** Operações caras, cada uma com o seu contador (10 por 15 min por usuário). */
    importsByUser: make('imports:user', 10, FIFTEEN_MINUTES, user),
    syncByUser: make('sync:user', 10, FIFTEEN_MINUTES, user),
    autoCheckByUser: make('auto-check:user', 10, FIFTEEN_MINUTES, user),
    whatsappWebhookByIp: make('whatsapp-webhook:ip', 60, MINUTE, ip),
    /** Atalhos do iOS: por IP (barra quem testa tokens ao acaso) e por token (um atalho em loop não derruba nada). */
    shortcutsByIp: make('shortcuts:ip', 60, MINUTE, ip),
    shortcutsByToken: make('shortcuts:token', 30, MINUTE, bearerHash),
    /** Leitura de PDF: abre uma thread por arquivo, então 10 por 15 min por pessoa (como o /imports). */
    pdfPreviewByUser: make('pdf-preview:user', 10, FIFTEEN_MINUTES, user),
  };
}
export type Limiters = ReturnType<typeof makeLimiters>;
