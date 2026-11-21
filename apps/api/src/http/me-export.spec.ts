// T2.5 · GET /me/export pela API de verdade (Fastify inject): auth, isolamento entre usuários, cabeçalhos de download,
// AuditLog e limite de 2 por dia por usuário.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';

const SECRET = 'segredo-de-teste-com-32-caracteres!!';

async function boot() {
  const repos = makeInMemoryRepositories();
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    jwtSecret: SECRET,
    webOrigin: 'https://tostao.test',
  });
  return { app, repos };
}
type App = Awaited<ReturnType<typeof boot>>['app'];

let ipCounter = 0;
const freshIp = () => `10.8.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

async function register(app: App, email: string, name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { 'x-forwarded-for': freshIp() },
    payload: { name, email, password: '12345678', acceptedTerms: true },
  });
  expect(res.statusCode).toBe(201);
  return res.json() as { accessToken: string };
}

async function bootWithTwoUsers() {
  const { app, repos } = await boot();
  const a = await register(app, 'export-a@exemplo.test', 'Exporta A');
  const b = await register(app, 'export-b@exemplo.test', 'Exporta B');
  const userA = (await repos.users.findByEmail('export-a@exemplo.test'))!;
  const userB = (await repos.users.findByEmail('export-b@exemplo.test'))!;
  await repos.transactions.create({
    userId: userA.id,
    accountId: null,
    externalId: null,
    description: 'LANCHE DA PESSOA A',
    amountInCents: -2500,
    occurredAt: new Date('2026-11-05T12:00:00Z'),
    categoryId: null,
    isInternalTransfer: false,
  });
  await repos.transactions.create({
    userId: userB.id,
    accountId: null,
    externalId: null,
    description: 'SEGREDO FINANCEIRO DA PESSOA B',
    amountInCents: -777_00,
    occurredAt: new Date('2026-11-06T12:00:00Z'),
    categoryId: null,
    isInternalTransfer: false,
  });
  return { app, repos, a, b, userA, userB };
}

describe('GET /me/export', () => {
  it('exige login (401 sem token) e não gera AuditLog', async () => {
    const { app, repos } = await boot();
    const res = await app.inject({ method: 'GET', url: '/me/export' });
    expect(res.statusCode).toBe(401);
    expect(repos.audit.items.filter((l) => l.action === 'data_exported')).toHaveLength(0);
  });

  it('baixa o JSON da própria pessoa: download, sem cache e SEM nada do outro usuário', async () => {
    const { app, a, userA, userB } = await bootWithTwoUsers();

    const res = await app.inject({
      method: 'GET',
      url: '/me/export',
      headers: { ...bearer(a.accessToken), 'x-forwarded-for': freshIp() },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="tostao-meus-dados-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers['cache-control']).toBe('no-store, private');
    const body = res.json();
    expect(body.profile).toMatchObject({ id: userA.id, email: 'export-a@exemplo.test', hasPassword: true });
    expect(body.transactions.map((t: { description: string }) => t.description)).toEqual(['LANCHE DA PESSOA A']);
    // isolamento: nada do B, e nenhum segredo
    for (const leak of [
      userB.id,
      'export-b@exemplo.test',
      'SEGREDO FINANCEIRO',
      'Exporta B',
      userA.passwordHash!,
      'passwordHash',
    ]) {
      expect(res.body).not.toContain(leak);
    }
  });

  it('não aceita pedir os dados de outra pessoa: query/header com o id do B é ignorado (vale só o token)', async () => {
    const { app, a, userA, userB } = await bootWithTwoUsers();
    const res = await app.inject({
      method: 'GET',
      url: `/me/export?userId=${userB.id}&id=${userB.id}`,
      headers: { ...bearer(a.accessToken), 'x-user-id': userB.id, 'x-forwarded-for': freshIp() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.id).toBe(userA.id);
    expect(res.body).not.toContain(userB.id);
    expect(res.body).not.toContain('SEGREDO FINANCEIRO');
  });

  it('cada download vira um AuditLog `data_exported` (IP e contagens, sem conteúdo) do usuário certo', async () => {
    const { app, repos, a, userA, userB } = await bootWithTwoUsers();
    const ip = freshIp();
    await app.inject({
      method: 'GET',
      url: '/me/export',
      headers: { ...bearer(a.accessToken), 'x-forwarded-for': ip },
    });

    const logs = repos.audit.items.filter((l) => l.action === 'data_exported');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ userId: userA.id, entityType: 'user', entityId: userA.id });
    expect(logs[0]!.metadata).toMatchObject({ formatVersion: 1, transactions: 1 });
    expect(logs[0]!.ipAddress).toBeTruthy();
    expect(JSON.stringify(logs[0])).not.toContain('LANCHE');
    expect(repos.audit.items.some((l) => l.action === 'data_exported' && l.userId === userB.id)).toBe(false);
  });

  it('RATE LIMIT: 2 por dia por usuário; a 3ª dá 429 (sem novo AuditLog); o outro usuário não é afetado', async () => {
    const { app, repos, a, b } = await bootWithTwoUsers();
    const get = (token: string) =>
      app.inject({ method: 'GET', url: '/me/export', headers: { ...bearer(token), 'x-forwarded-for': freshIp() } });

    expect((await get(a.accessToken)).statusCode).toBe(200);
    expect((await get(a.accessToken)).statusCode).toBe(200);
    const third = await get(a.accessToken);
    expect(third.statusCode).toBe(429);
    expect(third.json().message).toMatch(/Muitas tentativas/);
    expect(third.body).not.toContain('LANCHE');
    // trocar de IP não burla: o limite é por usuário
    expect((await get(a.accessToken)).statusCode).toBe(429);

    expect(repos.audit.items.filter((l) => l.action === 'data_exported')).toHaveLength(2);
    // o B tem a própria cota
    expect((await get(b.accessToken)).statusCode).toBe(200);
  });
});
