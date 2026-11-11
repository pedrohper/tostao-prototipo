import type { FastifyInstance } from 'fastify';
import { loginBody, registerBody, type AuthResponse, type ProfileResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

export function authRoutes(app: FastifyInstance, uc: UseCases) {
  app.post('/users', async (request, reply) => {
    const body = registerBody.parse(request.body);
    const { user } = await uc.registerUser.execute(body);
    const token = await reply.jwtSign({}, { sign: { sub: user.id } });
    return reply.status(201).send({ token } satisfies AuthResponse);
  });

  app.post('/sessions', async (request, reply) => {
    const body = loginBody.parse(request.body);
    const { user } = await uc.authenticate.execute(body);
    const token = await reply.jwtSign({}, { sign: { sub: user.id } });
    return reply.send({ token } satisfies AuthResponse);
  });

  app.get('/me', { onRequest: verifyJwt }, async (request) => {
    const { user, connections } = await uc.getProfile.execute({ userId: request.user.sub });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      connections: connections.map((c) => ({
        id: c.id, itemId: c.itemId, institution: c.institution, status: c.status,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
      })),
    } satisfies ProfileResponse;
  });
}
