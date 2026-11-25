import type { FastifyInstance } from 'fastify';
import {
  chatBody,
  pendingActionBody,
  scamCheckBody,
  type ChatHistoryResponse,
  type ChatMessageDTO,
  type ChatReplyResponse,
  type ChatStreamEvent,
  type ConfirmPendingActionResponse,
  type PendingActionDTO,
  type ScamCheckResponse,
} from '@tostao/contracts';
import type { PendingAction } from '../../services/pending-actions.js';
import type { AskStreamEvent } from '../../use-cases/ask-tostao.js';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import type { Limiters } from '../rate-limits.js';

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

/**
 * Intervalo do "ainda estou aqui" (linha de comentário SSE) enquanto o Tostão pensa. A API tem `connectionTimeout`
 * de 10 s (derruba socket sem tráfego) e proxies na frente também fecham conexão ociosa: sem isso, uma IA lenta no
 * 1º token derrubaria o stream no meio. Comentário SSE não é evento: o cliente ignora.
 */
export const SSE_HEARTBEAT_MS = 5_000;

/**
 * "Isso é golpe?" responde de uma vez só (sem streaming), e a IA pode passar dos 10 s do `connectionTimeout`.
 * Folga só nesta rota, acima do teto da própria análise (SCAM_AI_TIMEOUT_MS).
 */
export const SCAM_SOCKET_TIMEOUT_MS = 30_000;

/** Evento do caso de uso (objetos de domínio) -> evento do contrato (DTOs). */
function toStreamEvent(e: AskStreamEvent): ChatStreamEvent {
  if (e.type !== 'done') return e;
  return {
    type: 'done',
    question: dto(e.question),
    reply: dto(e.reply),
    remainingToday: e.remainingToday,
    pendingAction: e.pendingAction ? pendingDto(e.pendingAction) : null,
    cards: e.cards,
    followUps: e.followUps,
  };
}

// Conversa com o Tostão
export function chatRoutes(app: FastifyInstance, uc: UseCases, limits: Limiters) {
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
      cards: r.cards,
      followUps: r.followUps,
    } satisfies ChatReplyResponse;
  });

  // Mesma conversa do POST /chat, mas em SSE: `data: {json}` por evento (status, delta, done, error).
  // Consentimento (403), cota (429) e corpo inválido (400) saem como HTTP normal, ANTES do 1º byte: só depois que o
  // turno começou de verdade os erros viram evento. A pessoa fechar a aba cancela a chamada à IA e não grava nada.
  app.post('/chat/stream', { onRequest: verifyJwt }, async (request, reply) => {
    const { message } = chatBody.parse(request.body);
    const gone = new AbortController();
    reply.raw.once('close', () => {
      if (!reply.raw.writableEnded) gone.abort();
    });
    const events = uc.askTostao.stream({ userId: request.user.sub, message, signal: gone.signal });
    let first: IteratorResult<AskStreamEvent, void>;
    try {
      first = await events.next(); // roda o consentimento, a cota e o contexto; erro aqui = resposta HTTP normal
    } catch (e) {
      await events.return();
      throw e;
    }

    reply.hijack();
    const { 'content-length': _len, ...pluginHeaders } = reply.getHeaders() as Record<
      string,
      string | number | string[]
    >;
    reply.raw.writeHead(200, {
      ...pluginHeaders, // CORS, rate limit e Helmet que os plugins já puseram
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no', // nginx/proxy não pode segurar o texto até o fim
    });
    const send = (e: ChatStreamEvent) => {
      if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.write(`data: ${JSON.stringify(e)}\n\n`);
    };
    const heartbeat = setInterval(() => {
      if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.write(': ping\n\n');
    }, SSE_HEARTBEAT_MS);
    try {
      for (let r = first; !r.done; r = await events.next()) send(toStreamEvent(r.value));
    } catch (e) {
      request.log.error(e, 'chat/stream falhou no meio do turno');
      send({ type: 'error', message: 'Algo deu errado. Tenta de novo.', status: 500 });
    } finally {
      clearInterval(heartbeat);
      await events.return();
      if (!reply.raw.writableEnded) reply.raw.end();
    }
    return reply;
  });

  // "Isso é golpe?" (T6.20): avalia uma mensagem colada. Não grava nada; o corpo não vai pro log.
  app.post('/chat/scam-check', { onRequest: verifyJwt, preHandler: limits.scamCheckByUser }, async (request) => {
    const { message } = scamCheckBody.parse(request.body);
    request.raw.socket.setTimeout?.(SCAM_SOCKET_TIMEOUT_MS); // o `?.` é pro app.inject dos testes
    return (await uc.checkScam.execute({ userId: request.user.sub, message })) satisfies ScamCheckResponse;
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
