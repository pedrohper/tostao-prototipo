// T2.2 · GET /transactions/search pela API inteira (em memória): limit, cursor, nextCursor e erro de cursor inválido.
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { FakeBankGateway } from './gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from './repositories/in-memory/index.js';

async function boot() {
  const repos = makeInMemoryRepositories();
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    jwtSecret: 'segredo-de-teste-123',
    webOrigin: '*',
  });
  const reg = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { name: 'Pedro', email: 'p@x.com', password: '12345678', acceptedTerms: true },
  });
  const auth = { authorization: `Bearer ${reg.json().accessToken}` };
  const userId = (await repos.users.findByEmail('p@x.com'))!.id;
  const other = await repos.users.create({ name: 'Outra', email: 'o@x.com', passwordHash: 'x' });
  const add = (uid: string, description: string, cents: number, daysAgo: number) =>
    repos.transactions.create({
      userId: uid,
      accountId: null,
      externalId: null,
      description,
      amountInCents: cents,
      occurredAt: new Date(Date.now() - daysAgo * 86_400_000),
      categoryId: null,
      isInternalTransfer: false,
      seriesId: null,
    });
  return { app, auth, userId, other, add };
}

describe('GET /transactions/search', () => {
  it('pagina com limit + cursor, devolve nextCursor e o total do resultado todo', async () => {
    const { app, auth, userId, other, add } = await boot();
    for (let i = 1; i <= 5; i++) await add(userId, `PIX DANI ${i}`, -10_00 * i, i);
    await add(other.id, 'PIX DANI de outra pessoa', -999_00, 1);
    const get = (qs: string) => app.inject({ method: 'GET', url: `/transactions/search?${qs}`, headers: auth });

    const p1 = await get('q=dani&period=tudo&limit=2');
    expect(p1.statusCode).toBe(200);
    const b1 = p1.json();
    expect(b1.transactions.map((t: { description: string }) => t.description)).toEqual(['PIX DANI 1', 'PIX DANI 2']);
    expect(b1).toMatchObject({ count: 5, outInCents: 150_00 });
    expect(typeof b1.nextCursor).toBe('string');

    const p2 = (await get(`q=dani&period=tudo&limit=2&cursor=${encodeURIComponent(b1.nextCursor)}`)).json();
    expect(p2.transactions.map((t: { description: string }) => t.description)).toEqual(['PIX DANI 3', 'PIX DANI 4']);
    const p3 = (await get(`q=dani&period=tudo&limit=2&cursor=${encodeURIComponent(p2.nextCursor)}`)).json();
    expect(p3.transactions.map((t: { description: string }) => t.description)).toEqual(['PIX DANI 5']);
    expect(p3.nextCursor).toBeNull();
  });

  it('sem limit usa 50; limit fora de 1..200 e cursor inventado são 400; sem login é 401', async () => {
    const { app, auth, userId, add } = await boot();
    for (let i = 1; i <= 60; i++) await add(userId, `lanc ${i}`, -100, i);
    const get = (qs: string, headers: Record<string, string> = auth) =>
      app.inject({ method: 'GET', url: `/transactions/search?${qs}`, headers });
    const r = (await get('period=tudo&q=lanc')).json();
    expect(r.transactions).toHaveLength(50);
    expect(r.count).toBe(60);
    expect(r.nextCursor).not.toBeNull();
    for (const bad of ['limit=0', 'limit=201', 'limit=abc', 'cursor=lixo', 'cursor=']) {
      expect((await get(`period=tudo&${bad}`)).statusCode, bad).toBe(400);
    }
    expect((await get('period=tudo', {})).statusCode).toBe(401);
  });
});
