import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  activityBody, addFriendBody, pushSubscriptionBody, pushUnsubscribeBody,
  type FriendsResponse, type MissionsResponse, type PushKeyResponse, type RemindersResponse, type WeeklyResponse,
} from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import type { Repositories } from '../../repositories/types.js';
import type { PushGateway } from '../../gateways/push-gateway.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

/** Rotas que contam como missão quando dão certo. */
const TRACKED: Record<string, string> = {
  'POST /progress/:lessonId': 'licao',
  'PATCH /transactions/:id/category': 'categorizar',
  'POST /transactions/auto-categorize': 'categorizar',
  'POST /transactions': 'anotar',
  'POST /imports': 'anotar',
  'POST /tribunal/votes': 'tribunal',
  'POST /battles/tigrinho/start': 'batalha',
  'PUT /battles/urubu/steps/:stepId': 'batalha',
  'POST /goal/deposits': 'meta',
  'PUT /budgets/:categoryId': 'limites',
  'PUT /subscriptions/ignored': 'assinaturas',
  'POST /chat': 'chat',
};

// Missões do dia, ofensiva, amigos, avisos no celular e resumo da semana
export function engagementRoutes(app: FastifyInstance, uc: UseCases, repos: Repositories, push: PushGateway) {
  app.addHook('onResponse', async (request, reply) => {
    if (reply.statusCode >= 300) return;
    const kind = TRACKED[`${request.method} ${request.routeOptions.url}`];
    const userId = (request.user as { sub?: string } | undefined)?.sub;
    if (kind && userId) await uc.engagement.track(userId, kind).catch(() => {});
  });

  app.get('/missions', { onRequest: verifyJwt }, async (request) => (await uc.engagement.missions(request.user.sub)) satisfies MissionsResponse);

  app.post('/activity', { onRequest: verifyJwt }, async (request, reply) => {
    const { kind } = activityBody.parse(request.body);
    await uc.engagement.track(request.user.sub, kind);
    return reply.status(204).send();
  });

  app.get('/friends', { onRequest: verifyJwt }, async (request) => (await uc.engagement.friends(request.user.sub)) satisfies FriendsResponse);
  app.post('/friends', { onRequest: verifyJwt }, async (request) => {
    const { code } = addFriendBody.parse(request.body);
    return (await uc.engagement.addFriend(request.user.sub, code)) satisfies FriendsResponse;
  });
  app.delete('/friends/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return (await uc.engagement.removeFriend(request.user.sub, id)) satisfies FriendsResponse;
  });

  app.get('/reminders', { onRequest: verifyJwt }, async (request) => (await uc.engagement.reminders(request.user.sub)) satisfies RemindersResponse);
  app.get('/weekly', { onRequest: verifyJwt }, async (request) => (await uc.engagement.weekly(request.user.sub)) satisfies WeeklyResponse);

  app.get('/push/key', { onRequest: verifyJwt }, async (request) => ({
    publicKey: push.enabled ? push.publicKey : null,
    subscribed: (await repos.engagement.listPush(request.user.sub)).length,
  }) satisfies PushKeyResponse);
  app.post('/push/subscriptions', { onRequest: verifyJwt }, async (request, reply) => {
    const { endpoint, keys } = pushSubscriptionBody.parse(request.body);
    await repos.engagement.savePush({ endpoint, userId: request.user.sub, p256dh: keys.p256dh, auth: keys.auth });
    return reply.status(204).send();
  });
  app.post('/push/unsubscribe', { onRequest: verifyJwt }, async (request, reply) => {
    const { endpoint } = pushUnsubscribeBody.parse(request.body);
    const mine = await repos.engagement.listPush(request.user.sub);
    if (mine.some((s) => s.endpoint === endpoint)) await repos.engagement.deletePush(endpoint);
    return reply.status(204).send();
  });
}
