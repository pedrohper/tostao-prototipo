// T6.11 · /me/home-prefs pela API de verdade (Fastify inject): auth, isolamento, validação, export LGPD e exclusão.
import { MAX_ALERT_KEY_LENGTH } from '@tostao/contracts';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';

async function boot() {
  const repos = makeInMemoryRepositories();
  const app = await buildApp({
    repos,
    bank: new FakeBankGateway(),
    jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
    webOrigin: 'https://tostao.test',
  });
  return { app, repos };
}
type App = Awaited<ReturnType<typeof boot>>['app'];

let ipCounter = 0;
async function register(app: App, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: { 'x-forwarded-for': `10.61.1.${++ipCounter}` },
    payload: { name: 'Pessoa Teste', email, password: '12345678', acceptedTerms: true },
  });
  expect(res.statusCode).toBe(201);
  return { authorization: `Bearer ${(res.json() as { accessToken: string }).accessToken}` };
}

describe('/me/home-prefs', () => {
  it('exige login', async () => {
    const { app } = await boot();
    for (const method of ['GET', 'PATCH'] as const) {
      const res = await app.inject({ method, url: '/me/home-prefs', payload: method === 'PATCH' ? {} : undefined });
      expect(res.statusCode).toBe(401);
    }
  });

  it('celular grava, computador lê a mesma coisa, e outra pessoa não enxerga', async () => {
    const { app } = await boot();
    const a = await register(app, 'home-a@exemplo.test');
    const b = await register(app, 'home-b@exemplo.test');
    const read = async (headers: typeof a) =>
      (await app.inject({ method: 'GET', url: '/me/home-prefs', headers })).json();

    expect(await read(a)).toEqual({ prefs: null });
    const patch = await app.inject({
      method: 'PATCH',
      url: '/me/home-prefs',
      headers: a,
      payload: { layout: { ordem: ['aula', 'avisos'], ocultos: ['meta'] } },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.headers['cache-control']).toBe('no-store, private');
    expect(await read(a)).toEqual({
      prefs: { ordem: ['aula', 'avisos'], ocultos: ['meta'], fechados: [], v: 2 },
    });
    expect(await read(b)).toEqual({ prefs: null });
  });

  it('valores desconhecidos, grandes demais ou campo extra: 400 e nada é gravado', async () => {
    const { app, repos } = await boot();
    const a = await register(app, 'home-invalida@exemplo.test');
    const bad = [
      {},
      { layout: { ordem: ['inventado'], ocultos: [] } },
      { fechar: ['x'.repeat(MAX_ALERT_KEY_LENGTH + 1)] },
      { fechar: Array.from({ length: 200 }, (_, i) => `k${i}`) },
      { fechar: ['a'], userId: 'outra-pessoa' },
    ];
    for (const payload of bad) {
      const res = await app.inject({ method: 'PATCH', url: '/me/home-prefs', headers: a, payload });
      expect(res.statusCode, JSON.stringify(payload).slice(0, 80)).toBe(400);
    }
    expect((await repos.users.findByEmail('home-invalida@exemplo.test'))!.homePrefs).toBeNull();
  });

  it('não aparece no /me, entra no export LGPD e some com a conta', async () => {
    const { app, repos } = await boot();
    const a = await register(app, 'home-export@exemplo.test');
    await app.inject({ method: 'PATCH', url: '/me/home-prefs', headers: a, payload: { fechar: ['marca-do-aviso'] } });

    expect((await app.inject({ method: 'GET', url: '/me', headers: a })).body).not.toContain('marca-do-aviso');
    const dump = await app.inject({ method: 'GET', url: '/me/export', headers: a });
    expect(dump.json().profile.homePrefs).toEqual({ ordem: [], fechados: ['marca-do-aviso'] });

    await app.inject({ method: 'POST', url: '/me/delete', headers: a, payload: { password: '12345678' } });
    expect(JSON.stringify(repos.users.items)).not.toContain('marca-do-aviso');
  });
});
