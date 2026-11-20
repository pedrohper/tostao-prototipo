import type { FastifyInstance } from 'fastify';
import {
  updateTostaoAutoConfigBody,
  type ApplyTostaoInsightResponse,
  type RunTostaoCheckResponse,
  type TostaoAutoConfigDTO,
  type TostaoAutoResponse,
  type TostaoInsightDTO,
  idParam,
} from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import type { Limiters } from '../rate-limits.js';

export function tostaoAutoRoutes(app: FastifyInstance, uc: UseCases, limits: Limiters) {
  app.get('/tostao/auto', { onRequest: verifyJwt }, async (request) => {
    return (await uc.getTostaoAuto.execute({ userId: request.user.sub })) satisfies TostaoAutoResponse;
  });

  app.post('/tostao/auto/check', { onRequest: verifyJwt, preHandler: limits.autoCheckByUser }, async (request) => {
    return (await uc.runTostaoChecks.execute({ userId: request.user.sub })) satisfies RunTostaoCheckResponse;
  });

  app.post('/tostao/insights/:id/apply', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    return (await uc.applyTostaoInsight.execute({
      userId: request.user.sub,
      insightId: id,
    })) satisfies ApplyTostaoInsightResponse;
  });

  app.post('/tostao/insights/:id/dismiss', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    return (await uc.dismissTostaoInsight.execute({
      userId: request.user.sub,
      insightId: id,
    })) satisfies TostaoInsightDTO;
  });

  app.put('/tostao/auto/config', { onRequest: verifyJwt }, async (request) => {
    const patch = updateTostaoAutoConfigBody.parse(request.body);
    return (await uc.updateTostaoAutoConfig.execute({ userId: request.user.sub, patch })) satisfies TostaoAutoConfigDTO;
  });
}
