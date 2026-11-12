import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { financialPlanBody, lessonIdParam, monthQuery, setBudgetBody, type BudgetsResponse, type FinancialPlanResponse, type ForecastResponse, type IncomeSuggestionsResponse, type LessonProgressResponse } from '@tostao/contracts';
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

  // Renda, contas fixas e objetivo (onboarding) + previsão dos próximos meses
  app.get('/plan', { onRequest: verifyJwt }, async (request) => {
    return (await uc.getPlan.execute({ userId: request.user.sub })) satisfies FinancialPlanResponse;
  });

  app.put('/plan', { onRequest: verifyJwt }, async (request) => {
    const plan = financialPlanBody.parse(request.body);
    const r = await uc.savePlan.execute({ userId: request.user.sub, plan });
    return { plan: r.plan, updated: r.updated };
  });

  app.get('/plan/suggestions', { onRequest: verifyJwt }, async (request) => {
    return (await uc.suggestIncome.execute({ userId: request.user.sub })) satisfies IncomeSuggestionsResponse;
  });

  app.get('/forecast', { onRequest: verifyJwt }, async (request) => {
    return (await uc.forecast.execute({ userId: request.user.sub })) satisfies ForecastResponse;
  });
}
