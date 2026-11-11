import type { FastifyReply, FastifyRequest } from 'fastify';

// Barra quem não mandou "Authorization: Bearer <token>" válido.
// Depois daqui, request.user.sub é o id do usuário logado.
export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ message: 'Sessão expirada. Entra de novo.' });
  }
}
