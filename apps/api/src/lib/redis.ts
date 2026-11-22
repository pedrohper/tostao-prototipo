// Estado de curta duração que precisa ser compartilhado e de uso único: state do OAuth, contadores de tentativa.
// Em produção é Redis. O fallback em memória existe SÓ pra NODE_ENV=test: com mais de um processo
// (pm2 cluster, vários containers) um Map local deixaria o "uso único" e o limite de tentativas furados.
import { Redis } from 'ioredis';

export interface KeyValueStore {
  /** Guarda com validade. Sobrescreve. */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Lê e apaga numa operação só (uso único: dois pedidos simultâneos nunca recebem o mesmo valor). */
  getdel(key: string): Promise<string | null>;
  /** Soma 1 e devolve o total. A validade é definida na primeira soma e não renova. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  /** Subtrai 1 (estorno de cota reservada); nunca deixa abaixo de 0. Não cria a chave. */
  decr(key: string): Promise<void>;
  del(key: string): Promise<void>;
  /** Guarda SÓ se a chave não existe (SET NX): base do lock distribuído. true = esta chamada ganhou. */
  setnx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  /** Apaga só se o valor ainda é `value` (quem libera o lock é o dono; um lock já expirado e retomado por outro não cai). */
  delIfEquals(key: string, value: string): Promise<boolean>;
}

/** Só pra testes. Relógio injetável pra testar validade sem esperar. */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, { value: string; expiresAt: number }>();
  constructor(private readonly now: () => number = () => Date.now()) {}

  private live(key: string) {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.data.delete(key);
      return null;
    }
    return entry;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.data.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
  async get(key: string) {
    return this.live(key)?.value ?? null;
  }
  async getdel(key: string) {
    const entry = this.live(key);
    this.data.delete(key);
    return entry?.value ?? null;
  }
  async incr(key: string, ttlSeconds: number) {
    const entry = this.live(key);
    const next = (entry ? Number(entry.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? this.now() + ttlSeconds * 1000 });
    return next;
  }
  async decr(key: string) {
    const entry = this.live(key);
    if (entry) entry.value = String(Math.max(0, Number(entry.value) - 1));
  }
  async del(key: string) {
    this.data.delete(key);
  }
  async setnx(key: string, value: string, ttlSeconds: number) {
    if (this.live(key)) return false;
    this.data.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    return true;
  }
  async delIfEquals(key: string, value: string) {
    if (this.live(key)?.value !== value) return false;
    this.data.delete(key);
    return true;
  }
}

export class RedisKeyValueStore implements KeyValueStore {
  private readonly redis: Redis;

  /** Cliente ioredis compartilhado (o @fastify/rate-limit usa a mesma conexão, com prefixo próprio). */
  get client(): Redis {
    return this.redis;
  }

  /** `prefix` separa as chaves do Tostão das de outros serviços que dividem o mesmo Redis. */
  constructor(
    url: string,
    private readonly prefix = 'tostao:',
    redis?: Redis,
  ) {
    this.redis =
      redis ??
      new Redis(url, {
        connectTimeout: 5_000,
        commandTimeout: 3_000,
        maxRetriesPerRequest: 2,
      });
    // Sem ouvinte, um erro de conexão derruba o processo inteiro.
    this.redis.on('error', (err) => console.error('[redis]', err.message));
  }

  private k(key: string) {
    return `${this.prefix}${key}`;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    await this.redis.set(this.k(key), value, 'EX', ttlSeconds);
  }
  get(key: string) {
    return this.redis.get(this.k(key));
  }
  getdel(key: string) {
    return this.redis.getdel(this.k(key));
  }
  async incr(key: string, ttlSeconds: number) {
    const k = this.k(key);
    // MULTI: contar e definir a validade juntos. EXPIRE ... NX só vale se a chave ainda não tem validade.
    const res = await this.redis.multi().incr(k).expire(k, ttlSeconds, 'NX').exec();
    const count = res?.[0]?.[1];
    if (typeof count !== 'number') throw new Error('Redis não respondeu ao INCR');
    return count;
  }
  async decr(key: string) {
    // Lua: só desce se a chave existe e é > 0 (um DECR puro criaria a chave em -1 sem validade).
    await this.redis.eval(
      "local v = redis.call('GET', KEYS[1]); if v and tonumber(v) > 0 then redis.call('DECR', KEYS[1]) end",
      1,
      this.k(key),
    );
  }
  async del(key: string) {
    await this.redis.del(this.k(key));
  }
  async setnx(key: string, value: string, ttlSeconds: number) {
    return (await this.redis.set(this.k(key), value, 'EX', ttlSeconds, 'NX')) === 'OK';
  }
  async delIfEquals(key: string, value: string) {
    // Lua: comparar e apagar numa operação só (um GET seguido de DEL poderia apagar o lock de outro).
    const n = await this.redis.eval(
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      1,
      this.k(key),
      value,
    );
    return n === 1;
  }
}

export function createKeyValueStore({ redisUrl, nodeEnv }: { redisUrl: string; nodeEnv: string | undefined }) {
  if (redisUrl) return new RedisKeyValueStore(redisUrl);
  if (nodeEnv === 'test') return new MemoryKeyValueStore();
  throw new Error('REDIS_URL é obrigatório (o fallback em memória só existe com NODE_ENV=test).');
}

/** Padrão do buildApp: memória em teste; fora de teste, quem monta a app precisa passar o store de verdade. */
export function testOnlyKeyValueStore(): KeyValueStore {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Passe um KeyValueStore (Redis) ao buildApp: o fallback em memória é só pra NODE_ENV=test.');
  }
  return new MemoryKeyValueStore();
}
