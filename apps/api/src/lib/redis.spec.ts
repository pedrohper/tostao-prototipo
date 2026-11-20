import { describe, expect, it } from 'vitest';
import { createKeyValueStore, MemoryKeyValueStore } from './redis.js';

describe('MemoryKeyValueStore', () => {
  it('getdel é de uso único', async () => {
    const kv = new MemoryKeyValueStore();
    await kv.set('a', '1', 60);
    expect(await kv.getdel('a')).toBe('1');
    expect(await kv.getdel('a')).toBeNull();
  });

  it('expira pelo relógio', async () => {
    let now = 0;
    const kv = new MemoryKeyValueStore(() => now);
    await kv.set('a', '1', 10);
    now = 9_999;
    expect(await kv.get('a')).toBe('1');
    now = 10_000;
    expect(await kv.get('a')).toBeNull();
    expect(await kv.getdel('a')).toBeNull();
  });

  it('incr conta, e a validade vem da primeira soma (não renova)', async () => {
    let now = 0;
    const kv = new MemoryKeyValueStore(() => now);
    expect(await kv.incr('n', 10)).toBe(1);
    now = 6_000;
    expect(await kv.incr('n', 10)).toBe(2);
    now = 10_000; // 10 s depois da PRIMEIRA soma
    expect(await kv.incr('n', 10)).toBe(1);
  });

  it('decr estorna uma reserva, sem passar de 0 e sem criar chave', async () => {
    const kv = new MemoryKeyValueStore();
    await kv.decr('nada');
    expect(await kv.get('nada')).toBeNull();
    await kv.incr('n', 10);
    await kv.incr('n', 10);
    await kv.decr('n');
    expect(await kv.get('n')).toBe('1');
    await kv.decr('n');
    await kv.decr('n');
    expect(await kv.get('n')).toBe('0');
  });
});

describe('createKeyValueStore', () => {
  it('sem REDIS_URL só cai em memória em teste', () => {
    expect(createKeyValueStore({ redisUrl: '', nodeEnv: 'test' })).toBeInstanceOf(MemoryKeyValueStore);
    expect(() => createKeyValueStore({ redisUrl: '', nodeEnv: 'production' })).toThrow(/REDIS_URL/);
    expect(() => createKeyValueStore({ redisUrl: '', nodeEnv: 'development' })).toThrow(/REDIS_URL/);
  });
});
