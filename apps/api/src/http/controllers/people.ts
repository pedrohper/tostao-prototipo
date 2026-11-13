import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createPersonBody, linkPersonBody, personEntryBody, type PeopleResponse, type PersonDetailResponse } from '@tostao/contracts';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';
import { presentTransaction } from '../presenters.js';

/** Acertos: quem te deve e pra quem você deve. */
export function peopleRoutes(app: FastifyInstance, uc: UseCases) {
  app.get('/people', { onRequest: verifyJwt }, async (request) => {
    return (await uc.listPeople.execute({ userId: request.user.sub })) satisfies PeopleResponse;
  });

  // Acha pelo nome ou cria (mesmo nome não duplica)
  app.post('/people', { onRequest: verifyJwt }, async (request, reply) => {
    const { name } = createPersonBody.parse(request.body);
    const { person } = await uc.ensurePerson.execute({ userId: request.user.sub, name });
    return reply.status(201).send({ id: person.id });
  });

  app.get('/people/:id', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const r = await uc.getPerson.execute({ userId: request.user.sub, personId: id });
    return { person: r.person, transactions: r.transactions.map(presentTransaction) } satisfies PersonDetailResponse;
  });

  app.post('/people/:id/entries', { onRequest: verifyJwt }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = personEntryBody.parse(request.body);
    const { transaction } = await uc.addPersonEntry.execute({ ...body, userId: request.user.sub, personId: id, occurredAt: new Date(`${body.occurredAt}T12:00:00-03:00`) });
    return reply.status(201).send({ id: transaction.id });
  });

  app.delete('/people/:id', { onRequest: verifyJwt }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await uc.deletePerson.execute({ userId: request.user.sub, personId: id });
    return reply.status(204).send();
  });

  // "Essa compra não é minha" / "isso foi empréstimo" (personName null desfaz)
  app.put('/transactions/:id/person', { onRequest: verifyJwt }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { personName } = linkPersonBody.parse(request.body);
    const { person } = await uc.linkTransactionPerson.execute({ userId: request.user.sub, transactionId: id, personName });
    return { personId: person?.id ?? null };
  });
}
