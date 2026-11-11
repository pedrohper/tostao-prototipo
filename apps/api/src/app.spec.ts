// Teste de ponta a ponta da API inteira, com repositórios em memória (sem Postgres).
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { makeInMemoryRepositories } from './repositories/in-memory/index.js';
import { FakeBankGateway } from './gateways/fake-bank-gateway.js';
import { currentMonth } from './lib/month.js';

describe('API', () => {
  it('cadastro → conectar → resumo → categorizar', async () => {
    const app = await buildApp({ repos: makeInMemoryRepositories(), bank: new FakeBankGateway(), jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });

    const reg = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Pedro', email: 'P@X.com', password: '12345678' } });
    expect(reg.statusCode).toBe(201);
    const auth = { authorization: `Bearer ${reg.json().token}` };

    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().email).toBe('p@x.com');

    const conn = await app.inject({ method: 'POST', url: '/connections', headers: auth, payload: { itemId: 'item-de-exemplo' } });
    expect(conn.json().importedCount).toBe(12);

    const month = currentMonth();
    const list = (await app.inject({ method: 'GET', url: `/transactions?month=${month}`, headers: auth })).json();
    const pending = list.transactions.find((t: { categoryId: string | null; isInternalTransfer: boolean }) => !t.categoryId && !t.isInternalTransfer);
    const cat = await app.inject({ method: 'PATCH', url: `/transactions/${pending.id}/category`, headers: auth, payload: { categoryId: 'delivery', remember: true } });
    expect(cat.statusCode).toBe(200);

    const summary = (await app.inject({ method: 'GET', url: `/summary?month=${month}`, headers: auth })).json();
    expect(summary.uncategorizedCount).toBe(0);

    const bad = await app.inject({ method: 'POST', url: '/transactions', headers: auth, payload: { description: '', amountInCents: -5, kind: 'saida', occurredAt: 'ontem' } });
    expect(bad.statusCode).toBe(400);
  });
});
