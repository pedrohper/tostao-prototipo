// Teste de ponta a ponta da API inteira, com repositórios em memória (sem Postgres).
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { makeInMemoryRepositories } from './repositories/in-memory/index.js';
import { FakeBankGateway } from './gateways/fake-bank-gateway.js';
import { currentMonth } from './lib/month.js';
import { connectBankBody } from '@tostao/contracts';

describe('API', () => {
  it('cadastro → conectar → resumo → categorizar', async () => {
    const app = await buildApp({ repos: makeInMemoryRepositories(), bank: new FakeBankGateway(), jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });

    const reg = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Pedro', email: 'P@X.com', password: '12345678' } });
    expect(reg.statusCode).toBe(201);
    const auth = { authorization: `Bearer ${reg.json().token}` };

    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().email).toBe('p@x.com');

    // Com o banco de exemplo não tem widget: o token vem null e a tela mostra só o campo manual
    const token = await app.inject({ method: 'POST', url: '/connections/connect-token', headers: auth });
    expect(token.json()).toEqual({ connectToken: null });

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

    const me = (await app.inject({ method: 'GET', url: '/me', headers: auth })).json();
    const del = await app.inject({ method: 'DELETE', url: `/connections/${me.connections[0].id}`, headers: auth });
    expect(del.json()).toEqual({ providerDeleted: true });
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().connections).toHaveLength(0);
  });

  it('pesca o Item ID de dentro de um link colado', () => {
    const id = '3f1c2a9e-1b2c-4d5e-8f90-123456789abc';
    expect(connectBankBody.parse({ itemId: `https://meu.pluggy.ai/algo?itemId=${id.toUpperCase()}` }).itemId).toBe(id);
    expect(connectBankBody.parse({ itemId: `  ${id} ` }).itemId).toBe(id);
    expect(connectBankBody.safeParse({ itemId: 'curto' }).success).toBe(false);
  });
});
