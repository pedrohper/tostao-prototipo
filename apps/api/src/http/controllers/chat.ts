import type { FastifyInstance } from 'fastify';
import { chatBody, type ChatHistoryResponse, type ChatMessageDTO, type ChatReplyResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

const dto = (m: { id: string; role: 'user' | 'assistant'; content: string; createdAt: Date }): ChatMessageDTO =>
  ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() });

// Conversa com o Tostão
export function chatRoutes(app: FastifyInstance, uc: UseCases) {
  app.get('/chat', { onRequest: verifyJwt }, async (request) => {
    const { messages } = await uc.chatHistory.execute({ userId: request.user.sub });
    return { messages: messages.map(dto) } satisfies ChatHistoryResponse;
  });

  app.post('/chat', { onRequest: verifyJwt }, async (request) => {
    const { message } = chatBody.parse(request.body);
    const r = await uc.askTostao.execute({ userId: request.user.sub, message });
    return { question: dto(r.question), reply: dto(r.reply), remainingToday: r.remainingToday } satisfies ChatReplyResponse;
  });
}
