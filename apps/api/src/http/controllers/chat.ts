import type { FastifyInstance } from 'fastify';
import {
  chatBody,
  pendingActionBody,
  type ChatHistoryResponse,
  type ChatMessageDTO,
  type ChatReplyResponse,
  type ConfirmPendingActionResponse,
  type PendingActionDTO,
} from '@tostao/contracts';
import type { PendingAction } from '../../services/pending-actions.js';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

const dto = (m: { id: string; role: 'user' | 'assistant'; content: string; createdAt: Date }): ChatMessageDTO => ({
  id: m.id,
  role: m.role,
  content: m.content,
  createdAt: m.createdAt.toISOString(),
});

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pendingDto = (a: PendingAction): PendingActionDTO => ({
  id: a.id,
  kind: a.kind,
  summary: `${a.type === 'saida' ? 'Gasto' : 'Entrada'} de ${brl(a.amountInCents)}: ${a.description}${a.categoryName ? ` (${a.categoryName})` : ''}, em ${a.date.split('-').reverse().join('/')}`,
  description: a.description,
  amountInCents: a.amountInCents,
  type: a.type,
  categoryName: a.categoryName,
  date: a.date,
  expiresAt: a.expiresAt,
});

// Conversa com o Tostão
export function chatRoutes(app: FastifyInstance, uc: UseCases) {
  app.get('/chat', { onRequest: verifyJwt }, async (request) => {
    const { messages } = await uc.chatHistory.execute({ userId: request.user.sub });
    return { messages: messages.map(dto) } satisfies ChatHistoryResponse;
  });

  app.post('/chat', { onRequest: verifyJwt }, async (request) => {
    const { message } = chatBody.parse(request.body);
    const r = await uc.askTostao.execute({ userId: request.user.sub, message });
    return {
      question: dto(r.question),
      reply: dto(r.reply),
      remainingToday: r.remainingToday,
      pendingAction: r.pendingAction ? pendingDto(r.pendingAction) : null,
    } satisfies ChatReplyResponse;
  });

  // A IA só PROPÕE lançar uma transação; é aqui que a pessoa confirma (ou cancela). Uso único, vale 5 min.
  app.post('/chat/confirm', { onRequest: verifyJwt }, async (request) => {
    const { actionId } = pendingActionBody.parse(request.body);
    const r = await uc.pendingActions.confirm({ userId: request.user.sub, actionId });
    return { ok: true, message: r.message, transactionId: r.transactionId } satisfies ConfirmPendingActionResponse;
  });

  app.post('/chat/cancel', { onRequest: verifyJwt }, async (request) => {
    const { actionId } = pendingActionBody.parse(request.body);
    const r = await uc.pendingActions.cancel({ userId: request.user.sub, actionId });
    return { ok: true, message: r.message } satisfies ConfirmPendingActionResponse;
  });
}
