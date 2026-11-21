import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, z } from 'zod';
import { AppError } from '../domain/errors.js';

// Um lugar só traduz erro em resposta HTTP. Controller não tem try/catch.

const FASTIFY_MESSAGES: Record<number, string> = {
  400: 'Pedido inválido. Confere os dados e tenta de novo.',
  401: 'Sessão expirada. Entra de novo.',
  403: 'Sem permissão pra isso.',
  404: 'Não encontrei isso.',
  408: 'O pedido demorou demais pra chegar. Tenta de novo.',
  413: 'O pedido é grande demais.',
  414: 'Endereço longo demais.',
  415: 'Tipo de conteúdo não suportado.',
  429: 'Muitas tentativas. Espera um pouco e tenta de novo.',
};

type PrismaLikeError = { code: string; meta?: { code?: unknown } };

/** Erros conhecidos do Prisma (sem importar a classe: funciona igual com o client real e nos testes). */
function prismaStatus(error: unknown): { status: number; message: string } | null {
  const e = error as Partial<PrismaLikeError> | null;
  if (!e || typeof e.code !== 'string') return null;
  switch (e.code) {
    case 'P2002': // violação de unicidade
      return { status: 409, message: 'Isso já existe.' };
    case 'P2025': // registro não encontrado
      return { status: 404, message: 'Não encontrei isso.' };
    case 'P2003': // chave estrangeira
      return { status: 400, message: 'Referência inválida.' };
    case 'P2020': // valor fora da faixa do tipo
      return { status: 400, message: 'Valor fora do limite permitido.' };
    case '22003': // numeric_value_out_of_range do Postgres
      return { status: 400, message: 'Valor fora do limite permitido.' };
    case 'P2010': // erro de consulta crua: o código do Postgres vem em meta.code
    case 'P2004': // violação de CHECK/constraint
      if (e.meta?.code === '22003') return { status: 400, message: 'Valor fora do limite permitido.' };
      if (e.meta?.code === '23514') return { status: 400, message: 'Dado fora da regra permitida.' };
      return null;
    default:
      return null;
  }
}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply
      .status(400)
      .send({ message: error.issues[0]?.message ?? 'Dados inválidos', issues: z.flattenError(error).fieldErrors });
  }
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ message: error.message, ...(error.code ? { code: error.code } : {}) });
  }
  const prisma = prismaStatus(error);
  if (prisma) {
    // Violação de unicidade/FK é erro do cliente: não vaza o nome da tabela nem da coluna.
    return reply.status(prisma.status).send({ message: prisma.message });
  }
  // Erros nativos do Fastify (JSON inválido, corpo grande, tipo não suportado, limite de requisições...) já trazem o status.
  const status = (error as FastifyError).statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return reply.status(status).send({ message: FASTIFY_MESSAGES[status] ?? FASTIFY_MESSAGES[400] });
  }
  request.log.error(error);
  return reply.status(500).send({ message: 'Deu ruim aqui do nosso lado. Tenta de novo já já.' });
}
