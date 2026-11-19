import type { FastifyInstance } from 'fastify';
import { deleteAccountBody } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

export function accountRoutes(app: FastifyInstance, uc: UseCases) {
  // Apagar a conta de vez. Pede a senha (ou e-mail, em contas só sociais) pra confirmar.
  app.post('/me/delete', { onRequest: verifyJwt }, async (request, reply) => {
    const { password, confirmEmail } = deleteAccountBody.parse(request.body);
    await uc.deleteAccount.execute({ userId: request.user.sub, password, confirmEmail });
    return reply.status(204).send();
  });
}
