import type { FastifyInstance } from 'fastify';
import {
  consentsBody,
  deleteAccountBody,
  pixKeyBody,
  type ConsentsResponse,
  type DeleteAccountResponse,
  type PixKeyResponse,
} from '@tostao/contracts';
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

  // Portabilidade LGPD (art. 18, V): baixa tudo que o Tostão guarda da pessoa, num JSON. 2 por dia, com AuditLog.
  // Só olha o `sub` do token: não existe parâmetro de id, então não há como pedir os dados de outra pessoa.
  app.get('/me/export', { onRequest: verifyJwt, preHandler: limits.exportByUser }, async (request, reply) => {
    const { fileName, data } = await uc.exportUserData.execute({ userId: request.user.sub, ipAddress: request.ip });
    return reply
      .header('content-disposition', `attachment; filename="${fileName}"`)
      .header('cache-control', 'no-store, private')
      .type('application/json; charset=utf-8')
      .send(JSON.stringify(data, null, 2));
  });

  // Chave Pix da própria pessoa (T6.16). Rota separada do /me de propósito: a chave só trafega nas telas que usam.
  app.get('/me/pix-key', { onRequest: verifyJwt }, async (request) => {
    return (await uc.pixKey.get({ userId: request.user.sub })) satisfies PixKeyResponse;
  });

  app.put('/me/pix-key', { onRequest: verifyJwt, preHandler: limits.pixKeyByUser }, async (request) => {
    const { key } = pixKeyBody.parse(request.body);
    return (await uc.pixKey.set({ userId: request.user.sub, pixKey: key })) satisfies PixKeyResponse;
  });

  app.delete('/me/pix-key', { onRequest: verifyJwt, preHandler: limits.pixKeyByUser }, async (request, reply) => {
    await uc.pixKey.set({ userId: request.user.sub, pixKey: null });
    return reply.status(204).send();
  });

  // Consentimento LGPD pra usar IA. Sem ele, /chat, /transactions/auto-categorize e a IA do WhatsApp respondem 403.
  app.patch('/me/consents', { onRequest: verifyJwt }, async (request) => {
    const { aiConsent } = consentsBody.parse(request.body);
    const { aiConsentAt } = await uc.setAiConsent.execute({ userId: request.user.sub, accepted: aiConsent });
    return { aiConsentAt: aiConsentAt?.toISOString() ?? null } satisfies ConsentsResponse;
  });
}
