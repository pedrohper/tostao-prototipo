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

    // Cadastro aberto: entra sem convite; com convite, fica marcado quem chamou
    const semConvite = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Ana', email: 'a@x.com', password: '12345678' } });
    expect(semConvite.statusCode).toBe(201);
    const { code } = (await app.inject({ method: 'POST', url: '/invites', headers: auth })).json();
    const comConvite = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Bia', email: 'b@x.com', password: '12345678', inviteCode: code } });
    expect(comConvite.statusCode).toBe(201);

    // Sessão renova
    const refreshed = await app.inject({ method: 'POST', url: '/sessions/refresh', headers: auth });
    expect(refreshed.json().token).toEqual(expect.any(String));

    // 5 senhas erradas travam o e-mail
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/sessions', payload: { email: 'p@x.com', password: 'errada' } });
    expect((await app.inject({ method: 'POST', url: '/sessions', payload: { email: 'p@x.com', password: '12345678' } })).statusCode).toBe(429);
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

  it('limites por categoria e progresso das lições', async () => {
    const app = await buildApp({ repos: makeInMemoryRepositories(), bank: new FakeBankGateway(), jwtSecret: 'segredo-de-teste-123', webOrigin: '*' });
    const reg = await app.inject({ method: 'POST', url: '/users', payload: { name: 'Pedro', email: 'lim@x.com', password: '12345678' } });
    const auth = { authorization: `Bearer ${reg.json().token}` };
    await app.inject({ method: 'POST', url: '/connections', headers: auth, payload: { itemId: 'item-de-exemplo' } });
    const month = currentMonth();

    expect((await app.inject({ method: 'PUT', url: '/budgets/delivery', headers: auth, payload: { limitInCents: 30000 } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/budgets/salario', headers: auth, payload: { limitInCents: 100 } })).statusCode).toBe(400);
    const { budgets } = (await app.inject({ method: 'GET', url: `/budgets?month=${month}`, headers: auth })).json();
    expect(budgets).toHaveLength(1);
    expect(budgets[0]).toMatchObject({ categoryId: 'delivery', limitInCents: 30000 });
    expect(budgets[0].spentInCents).toBeGreaterThan(0);
    await app.inject({ method: 'PUT', url: '/budgets/delivery', headers: auth, payload: { limitInCents: null } });
    expect((await app.inject({ method: 'GET', url: `/budgets?month=${month}`, headers: auth })).json().budgets).toHaveLength(0);

    expect((await app.inject({ method: 'POST', url: '/progress/m1-l2', headers: auth })).statusCode).toBe(204);
    await app.inject({ method: 'POST', url: '/progress/m1-l2', headers: auth });
    expect((await app.inject({ method: 'POST', url: '/progress/qualquer', headers: auth })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/progress', headers: auth })).json()).toEqual({ done: ['m1-l2'], streakDays: 1, doneToday: 1 });
  });
});
