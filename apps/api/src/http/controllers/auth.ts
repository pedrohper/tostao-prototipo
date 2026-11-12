import type { FastifyInstance } from 'fastify';
import { loginBody, registerBody, resetPasswordBody, type AuthResponse, type InvitesResponse, type ProfileResponse } from '@tostao/contracts';
import { AppError, InvalidCredentialsError } from '../../domain/errors.js';
import { LoginLimiter } from '../login-limiter.js';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

export function authRoutes(app: FastifyInstance, uc: UseCases, limiter = new LoginLimiter()) {
  app.post('/users', async (request, reply) => {
    const body = registerBody.parse(request.body);
    const { user } = await uc.registerUser.execute(body);
    const token = await reply.jwtSign({}, { sign: { sub: user.id } });
    return reply.status(201).send({ token } satisfies AuthResponse);
  });

  app.post('/sessions', async (request, reply) => {
    const body = loginBody.parse(request.body);
    const wait = limiter.blockedFor(body.email);
    if (wait) throw new AppError(`Muitas tentativas. Espera ${wait} min e tenta de novo.`, 429);
    let user;
    try {
      ({ user } = await uc.authenticate.execute(body));
    } catch (e) {
      if (e instanceof InvalidCredentialsError) limiter.fail(body.email);
      throw e;
    }
    limiter.reset(body.email);
    const token = await reply.jwtSign({}, { sign: { sub: user.id } });
    return reply.send({ token } satisfies AuthResponse);
  });

  // Sessão que renova sozinha: a web troca o token quando ele passa de 1 dia.
  app.post('/sessions/refresh', { onRequest: verifyJwt }, async (request, reply) => {
    const token = await reply.jwtSign({}, { sign: { sub: request.user.sub } });
    return reply.send({ token } satisfies AuthResponse);
  });

  // Link de "esqueci a senha" (gerado no servidor com pnpm reset-link)
  app.post('/password-resets/redeem', async (request, reply) => {
    const body = resetPasswordBody.parse(request.body);
    const { userId } = await uc.resetPassword.execute(body);
    const token = await reply.jwtSign({}, { sign: { sub: userId } });
    return reply.send({ token } satisfies AuthResponse);
  });

  app.get('/invites', { onRequest: verifyJwt }, async (request) => {
    const { invites } = await uc.listInvites.execute({ userId: request.user.sub });
    return {
      invites: invites.map((i) => ({ code: i.code, createdAt: i.createdAt.toISOString(), usedAt: i.usedAt?.toISOString() ?? null, usedBy: i.usedBy })),
    } satisfies InvitesResponse;
  });

  app.post('/invites', { onRequest: verifyJwt }, async (request, reply) => {
    const { invite } = await uc.createInvite.execute({ userId: request.user.sub });
    return reply.status(201).send({ code: invite.code });
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
