import { describe, expect, it } from 'vitest';
import { withLock } from './lock.js';
import { MemoryKeyValueStore } from './redis.js';

const silent = { warn: () => undefined };

describe('withLock', () => {
  it('só um entra por vez; a segunda tentativa não roda; libera ao terminar (mesmo com erro)', async () => {
    const kv = new MemoryKeyValueStore();
    let inside = 0;
    const slow = () =>
      withLock(kv, 'k', 60, async () => {
        inside++;
        await new Promise((r) => setTimeout(r, 20));
        return 'ok';
      });
    const [a, b] = await Promise.all([slow(), slow()]);
    expect([a.ran, b.ran].sort()).toEqual([false, true]);
    expect(inside).toBe(1);
    await expect(withLock(kv, 'k', 60, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect((await withLock(kv, 'k', 60, async () => 1)).ran).toBe(true); // o erro liberou o lock
  });

  it('lock que EXPIROU e foi retomado por outra instância não é apagado por quem terminou depois', async () => {
    let now = 0;
    const kv = new MemoryKeyValueStore(() => now);
    const first = withLock(kv, 'k', 1, async () => {
      now += 5_000; // a 1ª demorou mais que o TTL: o lock expirou
      const second = await withLock(kv, 'k', 60, async () => {
        // a 2ª pegou o lock; a 1ª termina agora e NÃO pode apagá-lo
        return 'segunda';
      });
      expect(second.ran).toBe(true);
      await kv.setnx('k', 'dono-novo', 60);
    });
    await first;
    expect(await kv.get('k')).toBe('dono-novo'); // sobreviveu ao delIfEquals da primeira
  });

  it('Redis fora do ar: roda mesmo assim e avisa', async () => {
    const kv = new MemoryKeyValueStore();
    kv.setnx = async () => {
      throw new Error('down');
    };
    const warns: string[] = [];
    const r = await withLock(kv, 'k', 60, async () => 7, { warn: (m: string) => warns.push(m) });
    expect(r).toEqual({ ran: true, value: 7 });
    expect(warns[0]).toMatch(/Redis indisponível/);
    void silent;
  });
});
