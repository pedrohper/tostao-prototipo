import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { connectBankBody, importStatementBody, type ImportResponse, type ConnectTokenResponse, type DisconnectResponse, type SyncResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import type { Repositories } from '../../repositories/types.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import { ResourceNotFoundError } from '../../domain/errors.js';

export function bankRoutes(app: FastifyInstance, uc: UseCases, repos: Repositories) {
  // Depois de puxar transação nova, a IA tenta categorizar o que as regras não pegaram. Roda em segundo plano.
  const categorizeLater = (userId: string) => {
    void uc.autoCategorize.execute({ userId }).catch((err) => app.log.warn({ err }, 'categoria automática falhou'));
  };

  // A web pede um token, abre o Pluggy Connect e, no onSuccess, manda o item.id pro POST /connections.
  app.post('/connections/connect-token', { onRequest: verifyJwt }, async (request) => {
    return (await uc.createConnectToken.execute({ userId: request.user.sub })) satisfies ConnectTokenResponse;
  });

  app.post('/connections', { onRequest: verifyJwt }, async (request, reply) => {
    const { itemId } = connectBankBody.parse(request.body);
    const { importedCount, accounts } = await uc.connectBank.execute({ userId: request.user.sub, itemId });
    categorizeLater(request.user.sub);
    return reply.status(201).send({ importedCount, accounts } satisfies SyncResponse);
  });

  app.delete('/connections/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    return (await uc.disconnectBank.execute({ userId: request.user.sub, connectionId: id })) satisfies DisconnectResponse;
  });

  // Ocultar (ou mostrar de novo) uma conta, ex.: poupança que você não usa
  app.patch('/accounts/:id', { onRequest: verifyJwt }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { hidden } = z.object({ hidden: z.boolean() }).parse(request.body);
    await uc.setAccountHidden.execute({ userId: request.user.sub, accountId: id, hidden });
    return reply.status(204).send();
  });

  // Importar extrato (OFX/CSV) sem Pluggy
  app.post('/imports', { onRequest: verifyJwt, bodyLimit: 5 * 1024 * 1024 }, async (request, reply) => {
    const body = importStatementBody.parse(request.body);
    const r = await uc.importStatement.execute({ ...body, userId: request.user.sub });
    categorizeLater(request.user.sub);
    return reply.status(201).send({ ...r, from: r.from.toISOString(), to: r.to.toISOString() } satisfies ImportResponse);
  });

  app.post('/connections/:id/sync', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const connection = await repos.connections.findById(id);
    if (!connection || connection.userId !== request.user.sub) throw new ResourceNotFoundError('Conexão');
    const r = await uc.syncBankConnection.execute({ connectionId: id });
    categorizeLater(request.user.sub);
    return r satisfies SyncResponse;
  });
}
