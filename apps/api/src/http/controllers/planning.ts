import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lessonIdParam, monthQuery, setBudgetBody, type BudgetsResponse, type LessonProgressResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

// Limites por categoria e progresso da trilha
export function planningRoutes(app: FastifyInstance, uc: UseCases) {
  app.get('/budgets', { onRequest: verifyJwt }, async (request) => {
    const { month } = monthQuery.parse(request.query);
    return (await uc.getBudgets.execute({ userId: request.user.sub, month })) satisfies BudgetsResponse;
  });

  app.put('/budgets/:categoryId', { onRequest: verifyJwt }, async (request) => {
    const { categoryId } = z.object({ categoryId: z.string().min(1) }).parse(request.params);
    const { limitInCents } = setBudgetBody.parse(request.body);
    return uc.setBudget.execute({ userId: request.user.sub, categoryId, limitInCents });
  });

  app.get('/progress', { onRequest: verifyJwt }, async (request) => {
    return (await uc.listLessonProgress.execute({ userId: request.user.sub })) satisfies LessonProgressResponse;
  });

  app.post('/progress/:lessonId', { onRequest: verifyJwt }, async (request, reply) => {
    const { lessonId } = lessonIdParam.parse(request.params);
    await uc.markLessonDone.execute({ userId: request.user.sub, lessonId });
    return reply.status(204).send();
  });
}
