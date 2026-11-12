import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { connectBankBody, type ConnectTokenResponse, type DisconnectResponse, type SyncResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import type { Repositories } from '../../repositories/types.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import { ResourceNotFoundError } from '../../domain/errors.js';

export function bankRoutes(app: FastifyInstance, uc: UseCases, repos: Repositories) {
  // A web pede um token, abre o Pluggy Connect e, no onSuccess, manda o item.id pro POST /connections.
  app.post('/connections/connect-token', { onRequest: verifyJwt }, async (request) => {
    return (await uc.createConnectToken.execute({ userId: request.user.sub })) satisfies ConnectTokenResponse;
  });

  app.post('/connections', { onRequest: verifyJwt }, async (request, reply) => {
    const { itemId } = connectBankBody.parse(request.body);
    const { importedCount, accounts } = await uc.connectBank.execute({ userId: request.user.sub, itemId });
    return reply.status(201).send({ importedCount, accounts } satisfies SyncResponse);
  });

  app.delete('/connections/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return (await uc.disconnectBank.execute({ userId: request.user.sub, connectionId: id })) satisfies DisconnectResponse;
  });

  app.post('/connections/:id/sync', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const connection = await repos.connections.findById(id);
    if (!connection || connection.userId !== request.user.sub) throw new ResourceNotFoundError('Conexão');
    return (await uc.syncBankConnection.execute({ connectionId: id })) satisfies SyncResponse;
  });
}
