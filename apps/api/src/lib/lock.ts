// Lock distribuído em cima do KeyValueStore (Redis em produção). Serve pra dois processos/réplicas não rodarem o mesmo job
// ao mesmo tempo. NÃO é a garantia de correção: o job continua idempotente no Postgres (externalId único + trava de saldo).
// O lock só evita o trabalho duplicado. Se o Redis estiver fora do ar, o job roda mesmo assim (a idempotência segura).
import { randomUUID } from 'node:crypto';
import type { KeyValueStore } from './redis.js';

/** Roda `fn` se conseguir o lock `key`. Devolve `{ ran: false }` se outro processo já está rodando. */
export async function withLock<T>(
  kv: KeyValueStore,
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
  log: Pick<Console, 'warn'> = console,
): Promise<{ ran: true; value: T } | { ran: false }> {
  const owner = randomUUID();
  let held = false;
  try {
    held = await kv.setnx(key, owner, ttlSeconds);
    if (!held) return { ran: false };
  } catch (err) {
    log.warn(`[lock] Redis indisponível (${(err as Error).message}); seguindo sem lock, a idempotência protege.`);
  }
  try {
    return { ran: true, value: await fn() };
  } finally {
    if (held) await kv.delIfEquals(key, owner).catch(() => undefined);
  }
}
