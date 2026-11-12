import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tribunalVoteBody, urubuStepBody, type BattlesResponse, type TribunalResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

// Tribunal do Tostão (enquete da semana) e Batalhas (desafios conferidos no extrato)
export function gamesRoutes(app: FastifyInstance, uc: UseCases) {
  app.get('/tribunal', { onRequest: verifyJwt }, async (request) => {
    return (await uc.games.tribunal(request.user.sub)) satisfies TribunalResponse;
  });

  app.post('/tribunal/votes', { onRequest: verifyJwt }, async (request) => {
    const { caseId, choice } = tribunalVoteBody.parse(request.body);
    return (await uc.games.vote(request.user.sub, caseId, choice)) satisfies TribunalResponse;
  });

  app.get('/battles', { onRequest: verifyJwt }, async (request) => {
    return (await uc.games.battles(request.user.sub)) satisfies BattlesResponse;
  });

  app.post('/battles/tigrinho/start', { onRequest: verifyJwt }, async (request) => {
    return (await uc.games.startTigrinho(request.user.sub)) satisfies BattlesResponse;
  });

  app.put('/battles/urubu/steps/:stepId', { onRequest: verifyJwt }, async (request) => {
    const { stepId } = z.object({ stepId: z.string().min(1) }).parse(request.params);
    const { done } = urubuStepBody.parse(request.body);
    return (await uc.games.toggleUrubuStep(request.user.sub, stepId, done)) satisfies BattlesResponse;
  });
}
