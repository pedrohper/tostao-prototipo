import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError, z } from 'zod';
import { AppError } from '../domain/errors.js';

// Um lugar só traduz erro em resposta HTTP. Controller não tem try/catch.
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({ message: error.issues[0]?.message ?? 'Dados inválidos', issues: z.flattenError(error).fieldErrors });
  }
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ message: error.message });
  }
  request.log.error(error);
  return reply.status(500).send({ message: 'Deu ruim aqui do nosso lado. Tenta de novo já já.' });
}
