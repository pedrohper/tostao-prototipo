import type { FastifyInstance } from 'fastify';
import {
  createAutomationTokenBody,
  createRecurringRuleBody,
  idParam,
  shortcutWebhookBody,
  updateRecurringRuleBody,
  type AutomationTokensResponse,
  type CreateAutomationTokenResponse,
  type RecurringRulesResponse,
  type ShortcutWebhookResponse,
} from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import type { Limiters } from '../rate-limits.js';

/** T5.2 (recorrências) e T5.3 (tokens e webhook dos Atalhos do iOS). */
export function automationRoutes(app: FastifyInstance, uc: UseCases, limits: Limiters) {
  // ---------- recorrências / parcelamentos automáticos ----------
  app.get('/recurring-rules', { onRequest: verifyJwt }, async (request) => {
    return (await uc.recurringRules.list(request.user.sub)) satisfies RecurringRulesResponse;
  });
  app.post('/recurring-rules', { onRequest: verifyJwt }, async (request, reply) => {
    const body = createRecurringRuleBody.parse(request.body);
    return reply.status(201).send(await uc.recurringRules.create(request.user.sub, body));
  });
  app.patch('/recurring-rules/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    return uc.recurringRules.update(request.user.sub, id, updateRecurringRuleBody.parse(request.body));
  });
  app.delete('/recurring-rules/:id', { onRequest: verifyJwt }, async (request, reply) => {
    const { id } = idParam.parse(request.params);
    await uc.recurringRules.remove(request.user.sub, id);
    return reply.status(204).send();
  });

  // ---------- tokens de automação (tela /mais/atalhos) ----------
  app.get('/automation-tokens', { onRequest: verifyJwt }, async (request) => {
    return (await uc.automationTokens.list(request.user.sub)) satisfies AutomationTokensResponse;
  });
  app.post('/automation-tokens', { onRequest: verifyJwt, preHandler: limits.friendsByUser }, async (request, reply) => {
    const { label } = createAutomationTokenBody.parse(request.body);
    const r = await uc.automationTokens.create(request.user.sub, label);
    return reply.status(201).send(r satisfies CreateAutomationTokenResponse);
  });
  app.delete('/automation-tokens/:id', { onRequest: verifyJwt }, async (request, reply) => {
    const { id } = idParam.parse(request.params);
    await uc.automationTokens.revoke(request.user.sub, id);
    return reply.status(204).send();
  });

  // ---------- webhook dos Atalhos do iOS (sem JWT: o token de automação é a credencial) ----------
  // Ordem: limite por IP (antes de qualquer consulta) → autentica o token → limite por token → grava.
  app.post(
    '/webhooks/shortcuts',
    { preHandler: [limits.shortcutsByIp], bodyLimit: 16 * 1024 },
    async (request, reply) => {
      const token = await uc.automationTokens.authenticate(request.headers.authorization);
      await limits.shortcutsByToken(request, reply);
      const body = shortcutWebhookBody.parse(request.body);
      const r = await uc.shortcutWebhook.execute(token, body);
      return reply.status(r.duplicate ? 200 : 201).send(r satisfies ShortcutWebhookResponse);
    },
  );
}
