// T5.3 · Guarda TEMPORÁRIA (10 min, só na memória do servidor web) do arquivo compartilhado do Android.
// O POST do share target chega numa Route Handler; quem mostra a tela é uma página. Esta guarda liga as duas.
//
// Regras de segurança:
//  - amarrada à pessoa (o `sub` do token): o id (128 bits aleatórios) sozinho não abre nada pra outra pessoa;
//  - expira em 10 min e tem tetos (por pessoa e global) pra não virar jeito de encher a memória;
//  - nada é importado daqui: a pessoa SEMPRE confirma na tela (e a API valida o arquivo de novo).
// Limite conhecido: é memória do PROCESSO. Com 2+ réplicas do web (Fase 3), mover pro Redis.
import { randomBytes } from 'node:crypto';

export type StashedShare = { name: string; type: string; bytes: Uint8Array };
type Entry = StashedShare & { userKey: string; expiresAt: number };

export const SHARE_TTL_MS = 10 * 60_000;
export const SHARE_MAX_PER_USER = 3;
export const SHARE_MAX_TOTAL = 40;

// globalThis: no Next, a Route Handler e a página podem ser módulos separados; o Map precisa ser um só.
const KEY = Symbol.for('tostao.shareStash');
const store = (): Map<string, Entry> => {
  const g = globalThis as unknown as Record<symbol, Map<string, Entry> | undefined>;
  return (g[KEY] ??= new Map());
};

function sweep(now: number) {
  for (const [id, e] of store()) if (e.expiresAt <= now) store().delete(id);
}

/** Guarda e devolve o id. Passou do teto da pessoa: o mais antigo dela sai. Passou do teto global: recusa (null). */
export function putShare(userKey: string, share: StashedShare, now = Date.now()): string | null {
  sweep(now);
  const mine = [...store()].filter(([, e]) => e.userKey === userKey);
  while (mine.length >= SHARE_MAX_PER_USER) {
    const [oldest] = mine.shift()!;
    store().delete(oldest);
  }
  if (store().size >= SHARE_MAX_TOTAL) return null;
  const id = randomBytes(16).toString('base64url');
  store().set(id, { ...share, userKey, expiresAt: now + SHARE_TTL_MS });
  return id;
}

/** Lê SEM apagar (a página pode renderizar mais de uma vez). Id de outra pessoa ou vencido = null. */
export function peekShare(userKey: string, id: string, now = Date.now()): StashedShare | null {
  sweep(now);
  const e = store().get(id);
  return e && e.userKey === userKey ? { name: e.name, type: e.type, bytes: e.bytes } : null;
}

/** Lê e apaga (confirmou ou descartou). */
export function takeShare(userKey: string, id: string, now = Date.now()): StashedShare | null {
  const s = peekShare(userKey, id, now);
  if (s) store().delete(id);
  return s;
}

/** Só pra testes. */
export function clearShares() {
  store().clear();
}
