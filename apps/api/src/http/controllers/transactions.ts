import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { type AutoCategorizeResponse, searchQuery, type SearchResponse, categorizeBody, manualTransactionBody, monthQuery, type CategoryDTO, type MonthSummaryResponse, type SubscriptionsResponse, ignoreSubscriptionBody, createCategoryBody } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import { presentTransaction } from '../presenters.js';

export function transactionRoutes(app: FastifyInstance, uc: UseCases) {
  const categoryDto = ({ id, name, emoji, color, kind, userId }: { id: string; name: string; emoji: string; color: string; kind: CategoryDTO['kind']; userId?: string | null }) =>
    ({ id, name, emoji, color, kind, custom: !!userId }) satisfies CategoryDTO;

  // Do sistema + as que a pessoa criou
  app.get('/categories', { onRequest: verifyJwt }, async (request) => {
    const { categories } = await uc.listCategories.execute({ userId: request.user.sub });
    return { categories: categories.map(categoryDto) };
  });

  app.post('/categories', { onRequest: verifyJwt }, async (request, reply) => {
    const body = createCategoryBody.parse(request.body);
    const { category } = await uc.createCategory.execute({ ...body, userId: request.user.sub });
    return reply.status(201).send({ category: categoryDto(category) });
  });

  app.delete('/categories/:id', { onRequest: verifyJwt }, async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    await uc.deleteCategory.execute({ userId: request.user.sub, categoryId: id });
    return reply.status(204).send();
  });

  app.get('/summary', { onRequest: verifyJwt }, async (request) => {
    const { month } = monthQuery.parse(request.query);
    return (await uc.getMonthSummary.execute({ userId: request.user.sub, month })) satisfies MonthSummaryResponse;
  });

  app.get('/subscriptions', { onRequest: verifyJwt }, async (request) => {
    const r = await uc.listSubscriptions.execute({ userId: request.user.sub });
    const dto = (s: (typeof r.subscriptions)[number]) => ({ ...s, lastChargedAt: s.lastChargedAt.toISOString(), nextChargeAt: s.nextChargeAt.toISOString() });
    return { ...r, subscriptions: r.subscriptions.map(dto), ignored: r.ignored.map(dto) } satisfies SubscriptionsResponse;
  });

  // "Isso não é assinatura" (ou desfazer)
  app.put('/subscriptions/ignored', { onRequest: verifyJwt }, async (request, reply) => {
    const { key, ignored } = ignoreSubscriptionBody.parse(request.body);
    await uc.setSubscriptionIgnored.execute({ userId: request.user.sub, key, ignored });
    return reply.status(204).send();
  });

  app.get('/transactions', { onRequest: verifyJwt }, async (request) => {
    const { month } = monthQuery.parse(request.query);
    const { transactions } = await uc.listTransactions.execute({ userId: request.user.sub, month });
    return { transactions: transactions.map(presentTransaction) };
  });

  // Busca (vem antes do /:id pra "search" não virar id)
  app.get('/transactions/search', { onRequest: verifyJwt }, async (request) => {
    const query = searchQuery.parse(request.query);
    const r = await uc.searchTransactions.execute({ ...query, userId: request.user.sub });
    return { ...r, transactions: r.transactions.map(presentTransaction) } satisfies SearchResponse;
  });

  app.get('/transactions/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { transaction, rulePattern } = await uc.getTransaction.execute({ userId: request.user.sub, transactionId: id });
    return { transaction: presentTransaction(transaction), rulePattern };
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

  // "Deixa o Tostão categorizar": a IA tenta as pendentes agora (as que ela não souber continuam pendentes)
  app.post('/transactions/auto-categorize', { onRequest: verifyJwt }, async (request) => {
    return (await uc.autoCategorize.execute({ userId: request.user.sub })) satisfies AutoCategorizeResponse;
  });
}
