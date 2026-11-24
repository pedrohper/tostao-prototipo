// T6.1: desligamento limpo em SIGTERM/SIGINT.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShutdown, installShutdown } from './shutdown.js';

const log = { info: vi.fn(), error: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers();
  log.info.mockClear();
  log.error.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('createShutdown', () => {
  it('roda os passos na ordem (crons, http, prisma, redis) e sai com 0', async () => {
    const order: string[] = [];
    const exit = vi.fn();
    const shutdown = createShutdown({
      steps: ['crons', 'http', 'prisma', 'redis'].map((name) => ({ name, run: async () => void order.push(name) })),
      exit,
      log,
    });
    await shutdown('SIGTERM');
    expect(order).toEqual(['crons', 'http', 'prisma', 'redis']);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('um passo que falha não impede os seguintes e a saída é 1', async () => {
    const after = vi.fn();
    const exit = vi.fn();
    const shutdown = createShutdown({
      steps: [
        {
          name: 'http',
          run: () => {
            throw new Error('close falhou');
          },
        },
        { name: 'prisma', run: after },
      ],
      exit,
      log,
    });
    await shutdown('SIGINT');
    expect(after).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('passou de 10 s: sai com 1 mesmo com um passo pendurado', async () => {
    const exit = vi.fn();
    const shutdown = createShutdown({ steps: [{ name: 'http', run: () => new Promise(() => {}) }], exit, log });
    void shutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(9_999);
    expect(exit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('segundo sinal força a saída na hora, sem rodar os passos de novo', async () => {
    const exit = vi.fn();
    const run = vi.fn(() => new Promise(() => {}));
    const shutdown = createShutdown({ steps: [{ name: 'http', run }], exit, log });
    void shutdown('SIGTERM');
    await shutdown('SIGTERM');
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('installShutdown', () => {
  it('liga o mesmo handler em SIGTERM e SIGINT', async () => {
    const handlers = new Map<string, () => void>();
    const proc = { on: (sig: string, fn: () => void) => void handlers.set(sig, fn) } as unknown as NodeJS.Process;
    const stop = vi.fn();
    const exit = vi.fn();
    installShutdown({ steps: [{ name: 'crons', run: stop }], exit, log }, proc);
    expect([...handlers.keys()].sort()).toEqual(['SIGINT', 'SIGTERM']);
    handlers.get('SIGTERM')?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
