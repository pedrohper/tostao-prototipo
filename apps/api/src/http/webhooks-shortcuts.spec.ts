// T5.3 · POST /webhooks/shortcuts e a tela de tokens pela API de verdade (Fastify inject).
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
const freshIp = () => `10.9.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

async function register(app: App, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { 'x-forwarded-for': freshIp() },
    payload: { name: 'Pessoa', email, password: '12345678', acceptedTerms: true },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { accessToken: string }).accessToken;
}
async function newToken(app: App, jwt: string, label = 'Apple Pay') {
  const res = await app.inject({ method: 'POST', url: '/automation-tokens', headers: bearer(jwt), payload: { label } });
  expect(res.statusCode).toBe(201);
  return res.json() as { token: string; item: { id: string } };
}
const hook = (app: App, token: string | undefined, payload: unknown, ip = freshIp()) =>
  app.inject({
    method: 'POST',
    url: '/webhooks/shortcuts',
    headers: { ...(token ? bearer(token) : {}), 'x-forwarded-for': ip },
    payload: payload as never,
  });

describe('tokens (tela /mais/atalhos)', () => {
  it('exige login; cria, lista (sem o token) e revoga; máximo 3 ativos (409)', async () => {
    const { app } = await boot();
    expect((await app.inject({ method: 'GET', url: '/automation-tokens' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/automation-tokens', payload: { label: 'x' } })).statusCode).toBe(
      401,
    );
    const jwt = await register(app, 'a@exemplo.test');
    const t1 = await newToken(app, jwt, 'um');
    await newToken(app, jwt, 'dois');
    await newToken(app, jwt, 'tres');
    const four = await app.inject({
      method: 'POST',
      url: '/automation-tokens',
      headers: bearer(jwt),
      payload: { label: 'quatro' },
    });
    expect(four.statusCode).toBe(409);
    expect(four.json()).toMatchObject({ code: 'AUTOMATION_TOKEN_LIMIT' });
    const list = await app.inject({ method: 'GET', url: '/automation-tokens', headers: bearer(jwt) });
    expect(list.json().limit).toBe(3);
    expect(list.body).not.toContain(t1.token); // o token em claro nunca volta
    expect(list.body).not.toContain('tokenHash');
    expect(
      (await app.inject({ method: 'DELETE', url: `/automation-tokens/${t1.item.id}`, headers: bearer(jwt) }))
        .statusCode,
    ).toBe(204);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/automation-tokens',
          headers: bearer(jwt),
          payload: { label: 'quatro' },
        })
      ).statusCode,
    ).toBe(201);
  });

  it('rótulo vazio ou gigante: 400; revogar o token de outra pessoa: 404', async () => {
    const { app } = await boot();
    const a = await register(app, 'a@exemplo.test');
    const b = await register(app, 'b@exemplo.test');
    expect(
      (await app.inject({ method: 'POST', url: '/automation-tokens', headers: bearer(a), payload: { label: '' } }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/automation-tokens',
          headers: bearer(a),
          payload: { label: 'x'.repeat(61) },
        })
      ).statusCode,
    ).toBe(400);
    const tk = await newToken(app, a);
    expect(
      (await app.inject({ method: 'DELETE', url: `/automation-tokens/${tk.item.id}`, headers: bearer(b) })).statusCode,
    ).toBe(404);
  });
});

describe('POST /webhooks/shortcuts', () => {
  it('sem token, token inventado, malformado ou JWT de sessão no lugar: 401 (e nada é gravado)', async () => {
    const { app, repos } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const body = { source: 'apple_pay', amount: 10 };
    expect((await hook(app, undefined, body)).statusCode).toBe(401);
    expect((await hook(app, `tst_${'a'.repeat(43)}`, body)).statusCode).toBe(401);
    expect((await hook(app, 'qualquer-coisa', body)).statusCode).toBe(401);
    expect((await hook(app, jwt, body)).statusCode).toBe(401); // o JWT da sessão NÃO vale aqui
    expect(repos.transactions.items).toHaveLength(0);
  });

  it('token revogado: 401', async () => {
    const { app } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const tk = await newToken(app, jwt);
    expect((await hook(app, tk.token, { source: 'apple_pay', amount: 10 })).statusCode).toBe(201);
    await app.inject({ method: 'DELETE', url: `/automation-tokens/${tk.item.id}`, headers: bearer(jwt) });
    const res = await hook(app, tk.token, { source: 'apple_pay', amount: 10 });
    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe('Token inválido.');
  });

  it('token válido: 201 e o gasto cai pro dono do token, com o sinal certo', async () => {
    const { app, repos } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const tk = await newToken(app, jwt);
    const res = await hook(app, tk.token, { source: 'apple_pay', text: 'Compra aprovada R$ 45,90 em PADARIA CENTRAL' });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ duplicate: false });
    const user = (await repos.users.findByEmail('a@exemplo.test'))!;
    expect(repos.transactions.items).toHaveLength(1);
    expect(repos.transactions.items[0]).toMatchObject({
      userId: user.id,
      amountInCents: -45_90,
      description: 'PADARIA CENTRAL',
    });
  });

  it('idempotência: o mesmo eventId volta 200 duplicate:true, sem segundo lançamento', async () => {
    const { app, repos } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const tk = await newToken(app, jwt);
    const p = { source: 'shortcut', amount: 12.5, eventId: 'abc-123' };
    const a = await hook(app, tk.token, p);
    const b = await hook(app, tk.token, p);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(200);
    expect(b.json()).toEqual({ id: a.json().id, duplicate: true });
    expect(repos.transactions.items).toHaveLength(1);
  });

  it('corpo inválido: 400 (sem valor, origem desconhecida, JSON de outro tipo)', async () => {
    const { app } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const tk = await newToken(app, jwt);
    expect((await hook(app, tk.token, { source: 'apple_pay' })).statusCode).toBe(400);
    expect((await hook(app, tk.token, { source: 'whatsapp', amount: 1 })).statusCode).toBe(400);
    expect((await hook(app, tk.token, { source: 'apple_pay', amount: { x: 1 } })).statusCode).toBe(400);
    expect((await hook(app, tk.token, { source: 'apple_pay', text: 'sem valor aqui' })).statusCode).toBe(400);
  });

  it('corpo grande demais (> 16 KB): 413', async () => {
    const { app } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const tk = await newToken(app, jwt);
    const res = await hook(app, tk.token, { source: 'shortcut', amount: 1, text: 'x'.repeat(20_000) });
    expect(res.statusCode).toBe(413);
  });

  it('isolamento: o token do A nunca grava na conta do B', async () => {
    const { app, repos } = await boot();
    const ja = await register(app, 'a@exemplo.test');
    await register(app, 'b@exemplo.test');
    const ta = await newToken(app, ja);
    await hook(app, ta.token, { source: 'shortcut', amount: 3 });
    const b = (await repos.users.findByEmail('b@exemplo.test'))!;
    expect(repos.transactions.items.filter((t) => t.userId === b.id)).toHaveLength(0);
  });

  it('limite por token: a 31ª chamada no minuto dá 429; outro token não é afetado', async () => {
    const { app } = await boot();
    const jwt = await register(app, 'a@exemplo.test');
    const t1 = await newToken(app, jwt, 'um');
    const t2 = await newToken(app, jwt, 'dois');
    for (let i = 0; i < 30; i++)
      expect((await hook(app, t1.token, { source: 'shortcut', amount: 1 })).statusCode).toBe(201);
    const limited = await hook(app, t1.token, { source: 'shortcut', amount: 1 });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect((await hook(app, t2.token, { source: 'shortcut', amount: 1 })).statusCode).toBe(201);
  });

  it('limite por IP: quem testa tokens ao acaso leva 429 (a 61ª tentativa no minuto) antes de qualquer consulta', async () => {
    const { app } = await boot();
    const ip = '10.77.0.1';
    let last = 0;
    for (let i = 0; i < 61; i++)
      last = (
        await hook(app, `tst_${String(i).padStart(2, '0')}${'b'.repeat(41)}`, { source: 'shortcut', amount: 1 }, ip)
      ).statusCode;
    expect(last).toBe(429);
  });
});
