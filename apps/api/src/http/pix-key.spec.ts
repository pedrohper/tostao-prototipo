// T6.16 · /me/pix-key pela API de verdade (Fastify inject): auth, isolamento entre pessoas, validação, limite,
// export LGPD, exclusão da conta e chave fora do log.
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';

const SECRET = 'segredo-de-teste-com-32-caracteres!!';
const CPF = '529.982.247-25'; // fictício, só com dígitos verificadores válidos

async function boot(logStream?: PassThrough) {
  const repos = makeInMemoryRepositories();
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    jwtSecret: SECRET,
    webOrigin: 'https://tostao.test',
    ...(logStream ? { logger: true, logStream } : {}),
  });
  return { app, repos };
}
type App = Awaited<ReturnType<typeof boot>>['app'];

let ipCounter = 0;
const freshIp = () => `10.16.${Math.floor(++ipCounter / 250)}.${(ipCounter % 250) + 1}`;

async function register(app: App, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { 'x-forwarded-for': freshIp() },
    payload: { name: 'Pessoa Teste', email, password: '12345678', acceptedTerms: true },
  });
  expect(res.statusCode).toBe(201);
  return { authorization: `Bearer ${(res.json() as { accessToken: string }).accessToken}` };
}

describe('/me/pix-key', () => {
  it('exige login nas três operações', async () => {
    const { app } = await boot();
    for (const method of ['GET', 'PUT', 'DELETE'] as const) {
      const res = await app.inject({ method, url: '/me/pix-key', payload: method === 'PUT' ? {} : undefined });
      expect(res.statusCode).toBe(401);
    }
  });

  it('salva normalizada, mostra só pra dona, não aparece no /me e dá pra apagar', async () => {
    const { app } = await boot();
    const a = await register(app, 'pix-a@exemplo.test');
    const b = await register(app, 'pix-b@exemplo.test');

    expect((await app.inject({ method: 'GET', url: '/me/pix-key', headers: a })).json()).toEqual({
      pixKey: null,
      type: null,
    });
    const put = await app.inject({
      method: 'PUT',
      url: '/me/pix-key',
      headers: a,
      // um userId no corpo é ignorado: a chave é sempre de quem está logado
      payload: { type: 'cpf', key: CPF, userId: 'outra-pessoa' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ pixKey: '52998224725', type: 'cpf' });
    expect(put.headers['cache-control']).toBe('no-store, private');

    expect((await app.inject({ method: 'GET', url: '/me/pix-key', headers: b })).json().pixKey).toBeNull();
    expect((await app.inject({ method: 'GET', url: '/me', headers: a })).body).not.toContain('52998224725');

    expect((await app.inject({ method: 'DELETE', url: '/me/pix-key', headers: a })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/me/pix-key', headers: a })).json().pixKey).toBeNull();
  });

  it('chave inválida: 400 com mensagem em português e nada é gravado', async () => {
    const { app, repos } = await boot();
    const a = await register(app, 'pix-invalida@exemplo.test');
    const res = await app.inject({
      method: 'PUT',
      url: '/me/pix-key',
      headers: a,
      payload: { type: 'cpf', key: '123.456.789-00' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Esse CPF não confere. Olha os números de novo.');
    expect(res.body).not.toContain('123.456.789-00');
    expect((await repos.users.findByEmail('pix-invalida@exemplo.test'))!.pixKey).toBeNull();
  });

  it('limita as trocas: a 21ª em 15 minutos vira 429', async () => {
    const { app } = await boot();
    const a = await register(app, 'pix-limite@exemplo.test');
    const put = () => app.inject({ method: 'PUT', url: '/me/pix-key', headers: a, payload: { type: 'cpf', key: CPF } });
    for (let i = 0; i < 20; i++) expect((await put()).statusCode).toBe(200);
    expect((await put()).statusCode).toBe(429);
  });

  it('entra no export LGPD (só o da própria pessoa) e some junto com a conta', async () => {
    const { app, repos } = await boot();
    const a = await register(app, 'pix-export@exemplo.test');
    const b = await register(app, 'pix-outra@exemplo.test');
    await app.inject({ method: 'PUT', url: '/me/pix-key', headers: a, payload: { type: 'cpf', key: CPF } });
    await app.inject({
      method: 'PUT',
      url: '/me/pix-key',
      headers: b,
      payload: { type: 'email', key: 'chave-da-outra@exemplo.test' },
    });

    const dump = await app.inject({ method: 'GET', url: '/me/export', headers: a });
    expect(dump.json().profile.pixKey).toBe('52998224725');
    expect(dump.body).not.toContain('chave-da-outra@exemplo.test');

    const del = await app.inject({
      method: 'POST',
      url: '/me/delete',
      headers: a,
      payload: { password: '12345678' },
    });
    expect(del.statusCode).toBe(200);
    expect(JSON.stringify(repos.users.items)).not.toContain('52998224725');
    expect(JSON.stringify(repos.audit.items)).not.toContain('52998224725');
  });

  it('a chave nunca aparece no log (nem quando é inválida)', async () => {
    const stream = new PassThrough();
    let logged = '';
    stream.on('data', (chunk) => (logged += String(chunk)));
    const { app } = await boot(stream);
    const a = await register(app, 'pix-log@exemplo.test');
    await app.inject({ method: 'PUT', url: '/me/pix-key', headers: a, payload: { type: 'cpf', key: CPF } });
    await app.inject({ method: 'GET', url: '/me/pix-key', headers: a });
    await app.inject({
      method: 'PUT',
      url: '/me/pix-key',
      headers: a,
      payload: { type: 'cpf', key: '987.654.321-11' },
    });
    app.log.info({ user: { pixKey: '52998224725' } }, 'campo censurado');
    await new Promise((resolve) => setImmediate(resolve));
    expect(logged).toContain('/me/pix-key');
    expect(logged).toContain('[redacted]');
    for (const secret of ['52998224725', CPF, '987.654.321-11']) expect(logged).not.toContain(secret);
  });
});
