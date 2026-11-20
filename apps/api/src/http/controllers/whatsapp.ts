import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UseCases } from '../../use-cases/factories.js';
import {
  DisabledAudioTranscriber,
  normalizeWhatsAppFrom,
  sameSecret,
  type AudioTranscriber,
  type WhatsAppGateway,
} from '../../gateways/whatsapp-gateway.js';
import type { Limiters } from '../rate-limits.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

// Tudo que chega de fora passa por schema com limite de tamanho. Campo que não usamos é descartado.
const MAX_TEXT = 4096; // limite de uma mensagem de texto do WhatsApp (Meta)
const incomingMessage = z.object({
  id: z.string().min(1).max(200),
  from: z.string().min(1).max(32),
  type: z.string().max(32),
  text: z.object({ body: z.string().max(MAX_TEXT).optional() }).optional(),
  audio: z.object({ id: z.string().max(200).optional(), mime_type: z.string().max(100).optional() }).optional(),
});
const incomingSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(z.object({ value: z.object({ messages: z.array(incomingMessage).max(100).optional() }).optional() }))
          .max(50)
          .optional(),
      }),
    )
    .max(50)
    .optional(),
});
const hubQuery = z.object({
  'hub.mode': z.string().max(32).optional(),
  'hub.verify_token': z.string().max(256).optional(),
  // A Meta manda um número; só aceitamos caracteres inofensivos pra devolver no corpo.
  'hub.challenge': z
    .string()
    .max(256)
    .regex(/^[A-Za-z0-9_-]*$/)
    .optional(),
});
const n8nMessageSchema = z.object({
  id: z.string().max(200).optional(),
  from: z.string().max(100).optional(),
  text: z.string().max(MAX_TEXT).optional(),
  fromMe: z.boolean().optional(),
});

// WhatsApp: telas do app (ligar/desligar) + webhook da Meta (a única rota que fica pública, via Funnel).
type N8nIncoming = { id?: unknown; from?: unknown; text?: unknown; fromMe?: unknown };
type EvolutionKey = { id?: string; remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean };
type EvolutionIncoming = {
  event?: string;
  data?: { key?: EvolutionKey; message?: { conversation?: string; extendedTextMessage?: { text?: string } } };
};

/**
 * Aceita o formato simples { id, from, text, fromMe } ou o webhook cru da Evolution API (messages.upsert),
 * pra o n8n poder só repassar o corpo. Com @lid, usa o número real (remoteJidAlt/senderPn) quando vier.
 */
export function readN8nMessage(body: unknown): N8nIncoming {
  const evo = body as EvolutionIncoming;
  const key = evo?.data?.key;
  if (key && typeof key === 'object') {
    const event = (evo.event ?? 'messages.upsert').toLowerCase().replace('_', '.');
    if (event !== 'messages.upsert') return {};
    const remote = typeof key.remoteJid === 'string' ? key.remoteJid : undefined;
    const jid = remote?.endsWith('@lid') ? (key.remoteJidAlt ?? key.senderPn ?? remote) : remote;
    const m = evo.data?.message;
    return { id: key.id, from: jid, fromMe: key.fromMe, text: m?.conversation ?? m?.extendedTextMessage?.text };
  }
  return (body ?? {}) as N8nIncoming;
}

/**
 * Ponte com o n8n (API não oficial): o n8n manda { id, from, text } com X-Tostao-Secret e recebe { replies: string[] }.
 * Só é registrada na ponte isolada (http/n8n-bridge.ts, porta extra no IP do Docker), nunca no app principal.
 */
export function registerN8nRoute(instance: FastifyInstance, uc: UseCases, n8nSecret: string) {
  instance.post('/whatsapp/n8n', async (request, reply) => {
    if (!n8nSecret) return reply.status(404).send();
    if (!sameSecret(n8nSecret, request.headers['x-tostao-secret'] as string | undefined))
      return reply.status(401).send();
    const body = n8nMessageSchema.parse(readN8nMessage(request.body));
    const from = typeof body.from === 'string' ? normalizeWhatsAppFrom(body.from) : null;
    const text = body.text ?? '';
    if (body.fromMe || !from || !text.trim()) return { replies: [] };
    const replies: string[] = [];
    const id = body.id ? body.id : `${from}:${Date.now()}`;
    await uc.whatsappMessage.execute({ id, from, text }, async (t) => {
      replies.push(t);
    });
    return { replies };
  });
}

export function whatsappRoutes(
  app: FastifyInstance,
  uc: UseCases,
  wa: WhatsAppGateway,
  verifyToken: string,
  transcriber: AudioTranscriber = new DisabledAudioTranscriber(),
  limits?: Limiters,
) {
  app.get('/whatsapp', { onRequest: verifyJwt }, async (request) =>
    uc.whatsappLink.status({ userId: request.user.sub }),
  );
  app.post('/whatsapp/code', { onRequest: verifyJwt }, async (request) =>
    uc.whatsappLink.createCode({ userId: request.user.sub }),
  );
  app.delete('/whatsapp', { onRequest: verifyJwt }, async (request, reply) => {
    await uc.whatsappLink.unlink({ userId: request.user.sub });
    return reply.status(204).send();
  });

  // Webhook num escopo próprio: precisa do corpo cru pra conferir a assinatura da Meta.
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      (req as unknown as { rawBody: string }).rawBody = body as string;
      try {
        done(null, JSON.parse(body as string));
      } catch (e) {
        done(e as Error, undefined);
      }
    });

    // A Meta chama isso uma vez pra confirmar que a URL é nossa.
    scope.get('/whatsapp/webhook', async (request, reply) => {
      const q = hubQuery.parse(request.query);
      if (
        wa.enabled &&
        verifyToken &&
        q['hub.mode'] === 'subscribe' &&
        sameSecret(verifyToken, q['hub.verify_token']) // tempo constante, sem vazar o tamanho do token
      )
        return reply.type('text/plain').send(q['hub.challenge'] ?? '');
      return reply.status(403).send();
    });

    scope.post('/whatsapp/webhook', { preHandler: limits?.whatsappWebhookByIp ?? [] }, async (request, reply) => {
      if (!wa.enabled) return reply.status(404).send();
      const raw = (request as unknown as { rawBody: string }).rawBody;
      if (!wa.verifySignature(raw, request.headers['x-hub-signature-256'] as string | undefined))
        return reply.status(401).send();
      const body = incomingSchema.parse(request.body);
      const messages = (body.entry ?? []).flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []);
      // Responde 200 na hora (a Meta reenvia se demorar) e trata em segundo plano.
      for (const m of messages) {
        void (async () => {
          let text = m.type === 'text' ? (m.text?.body ?? '') : '';
          if (!text && m.type === 'audio' && m.audio?.id && wa.downloadMedia) {
            const media = await wa.downloadMedia(m.audio.id);
            if (media) text = (await transcriber.transcribe(media.bytes, media.mimeType)) ?? '';
          }
          if (!text.trim()) return;
          await uc.whatsappMessage.execute({ id: m.id, from: m.from, text });
        })().catch((err) => request.log.error({ err }, 'whatsapp falhou'));
      }
      return reply.status(200).send();
    });
  });
}
