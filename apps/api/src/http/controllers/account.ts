import type { FastifyInstance } from 'fastify';
import { deleteAccountBody } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

export function accountRoutes(app: FastifyInstance, uc: UseCases) {
  // Apagar a conta de vez. Pede a senha de novo pra ninguém apagar com o celular de outra pessoa.
  app.post('/me/delete', { onRequest: verifyJwt }, async (request, reply) => {
    const { password } = deleteAccountBody.parse(request.body);
    await uc.deleteAccount.execute({ userId: request.user.sub, password });
    return reply.status(204).send();
  });
}
