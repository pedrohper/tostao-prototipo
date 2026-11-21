// Limite de requisições com Redis REAL: o contador é compartilhado entre instâncias e sobrevive a restart.
// Só roda com TEST_REDIS_URL (use um banco de Redis descartável, ex.: redis://localhost:6379/9); sem ela, "skipped".
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { RedisKeyValueStore } from '../lib/redis.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';

const url = process.env.TEST_REDIS_URL;

describe.skipIf(!url)('rate limit no Redis real', () => {
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const stores: RedisKeyValueStore[] = [];
  let cleaner: Redis; // criado só quando o teste roda (describe.skipIf ainda executa este corpo)
  beforeAll(() => {
    cleaner = new Redis(url!);
  });

  const boot = () => {
    const kv = new RedisKeyValueStore(url!, `tostao:test-${ip}:`);
    stores.push(kv);
    return buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
      webOrigin: '*',
      kv,
    });
  };
  const register = (app: Awaited<ReturnType<typeof boot>>, i: number) =>
    app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'x-forwarded-for': ip },
      payload: { name: 'A', email: `a${i}@x.com`, password: '12345678' },
    });

  afterAll(async () => {
    const keys = await cleaner.keys(`tostao:rl:*${ip}*`);
    if (keys.length) await cleaner.del(...keys);
    await cleaner.quit();
    for (const s of stores) s.client.disconnect();
  });

  it('5 por IP em /users; o 6º leva 429, e a OUTRA instância da API (mesmo Redis) já enxerga o contador', async () => {
    const a = await boot();
    const b = await boot();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await register(a, i)).statusCode);
    expect(statuses.every((s) => s !== 429)).toBe(true);
    expect((await register(b, 4)).statusCode).not.toBe(429); // 5º, vindo da instância B
    expect((await register(a, 5)).statusCode).toBe(429); // 6º, na instância A: o contador é do Redis, não da memória
    expect((await register(b, 6)).statusCode).toBe(429);
  });

  it('as chaves ficam sob o prefixo tostao:rl: com validade (expiram sozinhas)', async () => {
    const keys = await cleaner.keys(`tostao:rl:*${ip}*`);
    expect(keys.length).toBeGreaterThan(0);
    const ttl = await cleaner.pttl(keys[0]!);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000);
  });

  it('o contador sobrevive a um "restart" (instância nova, mesmo Redis)', async () => {
    const restarted = await boot();
    expect((await register(restarted, 7)).statusCode).toBe(429);
  });
});
