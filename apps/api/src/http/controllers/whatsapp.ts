import type { FastifyInstance } from 'fastify';
import type { UseCases } from '../../use-cases/factories.js';
import { normalizeWhatsAppFrom, sameSecret, type WhatsAppGateway } from '../../gateways/whatsapp-gateway.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

type Incoming = { entry?: { changes?: { value?: { messages?: { id: string; from: string; type: string; text?: { body?: string } }[] } }[] }[] };

// WhatsApp: telas do app (ligar/desligar) + webhook da Meta (a única rota que fica pública, via Funnel).
type N8nIncoming = { id?: string; from?: string; text?: string; fromMe?: boolean };

export function whatsappRoutes(app: FastifyInstance, uc: UseCases, wa: WhatsAppGateway, verifyToken: string, n8nSecret = '') {
  app.get('/whatsapp', { onRequest: verifyJwt }, async (request) => uc.whatsappLink.status({ userId: request.user.sub }));
  app.post('/whatsapp/code', { onRequest: verifyJwt }, async (request) => uc.whatsappLink.createCode({ userId: request.user.sub }));
  app.delete('/whatsapp', { onRequest: verifyJwt }, async (request, reply) => {
    await uc.whatsappLink.unlink({ userId: request.user.sub });
    return reply.status(204).send();
  });

  // Webhook num escopo próprio: precisa do corpo cru pra conferir a assinatura da Meta.
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      (req as unknown as { rawBody: string }).rawBody = body as string;
      try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
    });

    // A Meta chama isso uma vez pra confirmar que a URL é nossa.
    scope.get('/whatsapp/webhook', async (request, reply) => {
      const q = request.query as Record<string, string | undefined>;
      if (wa.enabled && verifyToken && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === verifyToken) return reply.type('text/plain').send(q['hub.challenge'] ?? '');
      return reply.status(403).send();
    });

    scope.post('/whatsapp/webhook', async (request, reply) => {
      if (!wa.enabled) return reply.status(404).send();
      const raw = (request as unknown as { rawBody: string }).rawBody;
      if (!wa.verifySignature(raw, request.headers['x-hub-signature-256'] as string | undefined)) return reply.status(401).send();
      const body = request.body as Incoming;
      const messages = (body.entry ?? []).flatMap((e) => e.changes ?? []).flatMap((c) => c.value?.messages ?? []);
      // Responde 200 na hora (a Meta reenvia se demorar) e trata em segundo plano.
      for (const m of messages) {
        const text = m.type === 'text' ? m.text?.body ?? '' : '';
        if (!text.trim()) continue;
        void uc.whatsappMessage.execute({ id: m.id, from: m.from, text }).catch((err) => request.log.error({ err }, 'whatsapp falhou'));
      }
      return reply.status(200).send();
    });
  });

  // Ponte com o n8n (API não oficial). O n8n manda { id, from, text } com o header X-Tostao-Secret
  // e recebe { replies: string[] } pra mandar de volta no WhatsApp. Fica só na rede local.
  app.post('/whatsapp/n8n', async (request, reply) => {
    if (!n8nSecret) return reply.status(404).send();
    if (!sameSecret(n8nSecret, request.headers['x-tostao-secret'] as string | undefined)) return reply.status(401).send();
    const body = (request.body ?? {}) as N8nIncoming;
    const from = typeof body.from === 'string' ? normalizeWhatsAppFrom(body.from) : null;
    const text = typeof body.text === 'string' ? body.text : '';
    if (body.fromMe || !from || !text.trim()) return { replies: [] };
    const replies: string[] = [];
    const id = typeof body.id === 'string' && body.id ? body.id : `${from}:${Date.now()}`;
    await uc.whatsappMessage.execute({ id, from, text }, async (t) => { replies.push(t); });
    return { replies };
  });
}
