// T6.2: espera de dependência no boot e teto de tempo por operação.
import { describe, expect, it, vi } from 'vitest';
import { waitFor, withTimeout } from './wait-for.js';

const quietLog = { info: vi.fn(), warn: vi.fn() };

describe('waitFor', () => {
  it('passa na 3ª tentativa, esperando 1 s e depois 2 s', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const check = async () => {
      if (++calls < 3) throw new Error('the database system is starting up');
    };
    await waitFor('postgres', check, { sleep: async (ms) => void sleeps.push(ms), log: quietLog });
    expect(calls).toBe(3);
    expect(sleeps).toEqual([1_000, 2_000]);
  });

  it('desiste no teto: esperas 1, 2, 4, 8, 16 e o resto (29 s) somam 60 s, e lança com o motivo', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const check = async () => {
      calls++;
      throw new Error('ECONNREFUSED');
    };
    await expect(waitFor('redis', check, { sleep: async (ms) => void sleeps.push(ms), log: quietLog })).rejects.toThrow(
      /redis não respondeu em 7 tentativas \(60 s\): ECONNREFUSED/,
    );
    expect(sleeps).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 29_000]);
    expect(sleeps.reduce((a, b) => a + b, 0)).toBe(60_000);
    expect(calls).toBe(7);
  });

  it('registra cada tentativa que falhou no log', async () => {
    const warn = vi.fn();
    let calls = 0;
    await waitFor(
      'postgres',
      async () => {
        if (++calls < 2) throw new Error('boom');
      },
      { sleep: async () => {}, log: { info: vi.fn(), warn } },
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('tentativa 1');
  });

  it('uma tentativa pendurada conta como falha (teto por tentativa)', async () => {
    let calls = 0;
    const check = () => (++calls === 1 ? new Promise<never>(() => {}) : Promise.resolve());
    await waitFor('postgres', check, { attemptTimeoutMs: 20, sleep: async () => {}, log: quietLog });
    expect(calls).toBe(2);
  });
});

describe('withTimeout', () => {
  it('rejeita quando passa do tempo e devolve o valor quando não passa', async () => {
    await expect(withTimeout(new Promise(() => {}), 10, 'redis')).rejects.toThrow('redis passou de 10 ms');
    await expect(withTimeout(Promise.resolve(42), 50)).resolves.toBe(42);
  });
});
