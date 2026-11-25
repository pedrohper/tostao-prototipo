// T6.3: /health de verdade: banco e Redis checados, 503 quando algum falha, sem rate limit e sem dado sensível.
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';

class DownRedis extends MemoryKeyValueStore {
  override async ping(): Promise<void> {
    throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
  }
}

const boot = (opts: Partial<Parameters<typeof buildApp>[0]> = {}) =>
  buildApp({
    repos: makeInMemoryRepositories(),
    bank: new FakeBankGateway(),
    jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
    webOrigin: 'https://tostao.test',
    ...opts,
  });

describe('GET /health', () => {
  it('banco e Redis ok: 200 com { ok, db, redis } todos true', async () => {
    const app = await boot();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, db: true, redis: true });
  });

  it('banco falhando: 503 com db=false e redis=true, sem vazar o erro', async () => {
    const app = await boot({
      checkDb: async () => {
        throw new Error('FATAL: the database system is starting up');
      },
    });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ok: false, db: false, redis: true });
    expect(res.body).not.toContain('starting up');
  });

  it('Redis falhando: 503 com redis=false e db=true', async () => {
    const app = await boot({ kv: new DownRedis() });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ok: false, db: true, redis: false });
    expect(res.body).not.toContain('ECONNREFUSED');
  });

  it('dependência pendurada estoura em 2 s e conta como falha', async () => {
    const app = await boot({ checkDb: () => new Promise(() => {}) });
    const started = Date.now();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(Date.now() - started).toBeLessThan(3_500);
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ ok: false, db: false, redis: true });
  });

  it('continua sem cache-control e sem rate limit', async () => {
    const app = await boot();
    const statuses: number[] = [];
    for (let i = 0; i < 150; i++) statuses.push((await app.inject({ method: 'GET', url: '/health' })).statusCode);
    expect(statuses.every((s) => s === 200)).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/health' })).headers['cache-control']).toBeUndefined();
  });
});
