import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  type AutoCategorizeResponse,
  searchQuery,
  type SearchResponse,
  type NotesResponse,
  categorizeBody,
  manualTransactionBody,
  updateTransactionBody,
  transferLinkBody,
  monthQuery,
  summaryHistoryQuery,
  type SummaryHistoryResponse,
  type CategoryDTO,
  type MonthSummaryResponse,
  type SubscriptionsResponse,
  ignoreSubscriptionBody,
  createCategoryBody,
  idParam,
} from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import { presentTransaction } from '../presenters.js';
import type { Limiters } from '../rate-limits.js';

export function transactionRoutes(app: FastifyInstance, uc: UseCases, limits: Limiters) {
  const checkLater = (userId: string) => {
    void uc.runTostaoChecks.execute({ userId }).catch((err) => app.log.warn({ err }, 'rotina automática falhou'));
  };

  const categoryDto = ({
    id,
    name,
    emoji,
    color,
    kind,
    userId,
  }: {
    id: string;
    name: string;
    emoji: string;
    color: string;
    kind: CategoryDTO['kind'];
    userId?: string | null;
  }) => ({ id, name, emoji, color, kind, custom: !!userId }) satisfies CategoryDTO;

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
    const { id } = idParam.parse(request.params);
    await uc.deleteCategory.execute({ userId: request.user.sub, categoryId: id });
    return reply.status(204).send();
  });

  app.get('/summary', { onRequest: verifyJwt }, async (request) => {
    const { month } = monthQuery.parse(request.query);
    return (await uc.getMonthSummary.execute({ userId: request.user.sub, month })) satisfies MonthSummaryResponse;
  });

  // Evolução mensal (Home). Vem antes de qualquer rota com parâmetro em /summary.
  app.get('/summary/history', { onRequest: verifyJwt }, async (request) => {
    const { month, months } = summaryHistoryQuery.parse(request.query);
    return (await uc.getSummaryHistory.execute({
      userId: request.user.sub,
      month,
      months,
    })) satisfies SummaryHistoryResponse;
  });

  app.get('/subscriptions', { onRequest: verifyJwt }, async (request) => {
    const r = await uc.listSubscriptions.execute({ userId: request.user.sub });
    const dto = (s: (typeof r.subscriptions)[number]) => ({
      ...s,
      lastChargedAt: s.lastChargedAt.toISOString(),
      nextChargeAt: s.nextChargeAt.toISOString(),
    });
    return {
      ...r,
      subscriptions: r.subscriptions.map(dto),
      ignored: r.ignored.map(dto),
    } satisfies SubscriptionsResponse;
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
  // Tela Anotações: o que foi anotado à mão + histórico do que o app apagou sozinho.
  app.get('/notes', { onRequest: verifyJwt }, async (request): Promise<NotesResponse> => {
    return uc.listNotes.execute({ userId: request.user.sub });
  });

  app.get('/transactions/search', { onRequest: verifyJwt }, async (request) => {
    const query = searchQuery.parse(request.query);
    const r = await uc.searchTransactions.execute({ ...query, userId: request.user.sub });
    return { ...r, transactions: r.transactions.map(presentTransaction) } satisfies SearchResponse;
  });

  app.get('/transactions/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    const { transaction, rulePattern } = await uc.getTransaction.execute({
      userId: request.user.sub,
      transactionId: id,
    });
    return { transaction: presentTransaction(transaction), rulePattern };
  });

  app.post('/transactions', { onRequest: verifyJwt }, async (request, reply) => {
    const body = manualTransactionBody.parse(request.body);
    const { transaction } = await uc.createManualTransaction.execute({
      ...body,
      userId: request.user.sub,
      occurredAt: new Date(`${body.occurredAt}T12:00:00-03:00`),
    });
    checkLater(request.user.sub);
    return reply.status(201).send({ id: transaction.id });
  });

  // Apaga um lançamento anotado (com ?serie=1, também os próximos do "todo mês"/parcelado)
  app.delete('/transactions/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    const { serie } = z.object({ serie: z.enum(['0', '1']).optional() }).parse(request.query);
    return uc.deleteTransaction.execute({ userId: request.user.sub, transactionId: id, series: serie === '1' });
  });

  // "É pagamento de fatura" / "Transferi pra outra conta minha" (kind: 'none' desfaz).
  app.patch('/transactions/:id/transfer-link', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    const body = transferLinkBody.parse(request.body);
    return uc.transferLink.execute({ ...body, userId: request.user.sub, transactionId: id });
  });

  app.patch('/transactions/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    const body = updateTransactionBody.parse(request.body);
    const { transaction } = await uc.updateTransaction.execute({
      ...body,
      userId: request.user.sub,
      transactionId: id,
    });
    checkLater(request.user.sub);
    return {
      id: transaction.id,
      isInternalTransfer: transaction.isInternalTransfer,
      settled: transaction.settledAt !== null,
    };
  });

  app.patch('/transactions/:id/category', { onRequest: verifyJwt }, async (request) => {
    const { id } = idParam.parse(request.params);
    const body = categorizeBody.parse(request.body);
    const r = await uc.categorizeTransaction.execute({ ...body, userId: request.user.sub, transactionId: id });
    checkLater(request.user.sub);
    return r;
  });

  // "Deixa o Tostão categorizar": a IA tenta as pendentes agora (as que ela não souber continuam pendentes)
  app.post(
    '/transactions/auto-categorize',
    { onRequest: verifyJwt, preHandler: limits.autoCategorizeByUser },
    async (request) => {
      const r = (await uc.autoCategorize.execute({
        userId: request.user.sub,
        source: 'user',
        requireConsent: true,
      })) satisfies AutoCategorizeResponse;
      checkLater(request.user.sub);
      return r;
    },
  );
}
