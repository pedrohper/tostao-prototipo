// T1.6 · daily-sync: só conexão com provedor entra; erro tenta de novo a cada 24 h; 3 falhas tiram da fila.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import type { SyncBankConnectionUseCase } from '../use-cases/sync-bank-connection.js';
import { isSyncStale, RETRY_AFTER_MS, syncAllConnections } from './daily-sync.js';

const NOW = new Date('2026-11-21T12:00:00Z');
const silent = { info: () => {}, error: () => {} } as unknown as Console;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

async function conn(
  repos: ReturnType<typeof makeInMemoryRepositories>,
  itemId: string,
  patch: Partial<{
    status: 'ACTIVE' | 'ERROR' | 'RECONNECT_REQUIRED';
    lastErrorAt: Date | null;
    errorCount: number;
    lastSyncedAt: Date | null;
  }> = {},
) {
  const c = await repos.connections.create({ userId: 'u1', itemId, institution: null });
  await repos.connections.save({ ...c, ...patch });
  return c;
}
const fakeSync = (calls: string[]) =>
  ({
    execute: async ({ connectionId }: { connectionId: string }) => (
      calls.push(connectionId),
      { importedCount: 0, reconciledCount: 0 }
    ),
  }) as unknown as SyncBankConnectionUseCase;

describe('syncAllConnections', () => {
  it('nunca sincroniza conexão de importação (import:) nem conta manual (manual:)', async () => {
    const repos = makeInMemoryRepositories();
    const real = await conn(repos, 'item-real');
    await conn(repos, 'import:nubank');
    await conn(repos, 'manual:contas');
    const calls: string[] = [];
    expect(await syncAllConnections(repos, fakeSync(calls), silent)).toBe(1);
    expect(calls).toEqual([real.id]);
  });

  it('conexão em ERROR só volta a tentar depois de 24 h da última falha', async () => {
    const repos = makeInMemoryRepositories();
    const recente = await conn(repos, 'item-a', {
      status: 'ERROR',
      errorCount: 1,
      lastErrorAt: new Date(NOW.getTime() - RETRY_AFTER_MS + 60_000),
    });
    const velho = await conn(repos, 'item-b', {
      status: 'ERROR',
      errorCount: 2,
      lastErrorAt: new Date(NOW.getTime() - RETRY_AFTER_MS - 60_000),
    });
    const calls: string[] = [];
    await syncAllConnections(repos, fakeSync(calls), silent);
    expect(calls).toEqual([velho.id]);
    expect(calls).not.toContain(recente.id);
  });

  it('RECONNECT_REQUIRED nunca volta sozinha pra fila', async () => {
    const repos = makeInMemoryRepositories();
    await conn(repos, 'item-c', {
      status: 'RECONNECT_REQUIRED',
      errorCount: 3,
      lastErrorAt: new Date(NOW.getTime() - 30 * 24 * 3600_000),
    });
    const calls: string[] = [];
    expect(await syncAllConnections(repos, fakeSync(calls), silent)).toBe(0);
    expect(calls).toEqual([]);
  });

  it('uma conexão que falha não derruba as próximas', async () => {
    const repos = makeInMemoryRepositories();
    const a = await conn(repos, 'item-1');
    const b = await conn(repos, 'item-2');
    const calls: string[] = [];
    const sync = {
      execute: async ({ connectionId }: { connectionId: string }) => {
        calls.push(connectionId);
        if (connectionId === a.id) throw new Error('boom');
        return { importedCount: 0 };
      },
    } as unknown as SyncBankConnectionUseCase;
    await syncAllConnections(repos, sync, silent);
    expect(calls).toEqual([a.id, b.id]);
  });
});

describe('isSyncStale (decide se o restart dispara um sync geral)', () => {
  it('conexão de importação ou manual nunca conta como "atrasada" (antes um restart sincronizava tudo à toa)', async () => {
    const repos = makeInMemoryRepositories();
    await conn(repos, 'item-ok', { lastSyncedAt: new Date(NOW.getTime() - 3600_000) });
    await conn(repos, 'import:x', { lastSyncedAt: null });
    await conn(repos, 'manual:contas', { lastSyncedAt: null });
    expect(await isSyncStale(repos, 6 * 3600_000, NOW)).toBe(false);
  });

  it('conexão real parada há mais que o limite conta', async () => {
    const repos = makeInMemoryRepositories();
    await conn(repos, 'item-velho', { lastSyncedAt: new Date(NOW.getTime() - 10 * 3600_000) });
    expect(await isSyncStale(repos, 6 * 3600_000, NOW)).toBe(true);
  });
});
