import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { categorizeBody, manualTransactionBody, monthQuery, type CategoryDTO, type MonthSummaryResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import { presentTransaction } from '../presenters.js';

export function transactionRoutes(app: FastifyInstance, uc: UseCases) {
  app.get('/categories', async () => {
    const { categories } = await uc.listCategories.execute();
    return { categories: categories.map(({ id, name, emoji, color }) => ({ id, name, emoji, color }) satisfies CategoryDTO) };
  });

  app.get('/summary', { onRequest: verifyJwt }, async (request) => {
    const { month } = monthQuery.parse(request.query);
    return (await uc.getMonthSummary.execute({ userId: request.user.sub, month })) satisfies MonthSummaryResponse;
  });

  app.get('/transactions', { onRequest: verifyJwt }, async (request) => {
    const { month } = monthQuery.parse(request.query);
    const { transactions } = await uc.listTransactions.execute({ userId: request.user.sub, month });
    return { transactions: transactions.map(presentTransaction) };
  });

  app.post('/transactions', { onRequest: verifyJwt }, async (request, reply) => {
    const body = manualTransactionBody.parse(request.body);
    const { transaction } = await uc.createManualTransaction.execute({
      ...body,
      userId: request.user.sub,
      occurredAt: new Date(`${body.occurredAt}T12:00:00-03:00`),
    });
    return reply.status(201).send({ id: transaction.id });
  });

  app.patch('/transactions/:id/category', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = categorizeBody.parse(request.body);
    return uc.categorizeTransaction.execute({ ...body, userId: request.user.sub, transactionId: id });
  });
}
