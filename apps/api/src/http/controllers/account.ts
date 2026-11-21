import type { FastifyInstance } from 'fastify';
import { consentsBody, deleteAccountBody, type ConsentsResponse, type DeleteAccountResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import type { Limiters } from '../rate-limits.js';

export function accountRoutes(app: FastifyInstance, uc: UseCases, limits: Limiters) {
  // Apagar a conta de vez. Pede a senha (ou e-mail, em contas só sociais) pra confirmar.
  app.post('/me/delete', { onRequest: verifyJwt, preHandler: limits.deleteAccountByUser }, async (request, reply) => {
    const { password, confirmEmail } = deleteAccountBody.parse(request.body);
    const { providerFailures } = await uc.deleteAccount.execute({ userId: request.user.sub, password, confirmEmail });
    // 200 com o relatório (e não 204): se o provedor falhou em desligar algum banco, a pessoa precisa saber.
    return reply.send({ deleted: true, providerFailures } satisfies DeleteAccountResponse);
  });

  // Consentimento LGPD pra usar IA. Sem ele, /chat, /transactions/auto-categorize e a IA do WhatsApp respondem 403.
  app.patch('/me/consents', { onRequest: verifyJwt }, async (request) => {
    const { aiConsent } = consentsBody.parse(request.body);
    const { aiConsentAt } = await uc.setAiConsent.execute({ userId: request.user.sub, accepted: aiConsent });
    return { aiConsentAt: aiConsentAt?.toISOString() ?? null } satisfies ConsentsResponse;
  });
}
