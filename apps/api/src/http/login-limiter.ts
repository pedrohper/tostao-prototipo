// Limite de tentativas erradas. A API fica atrás do Next (todo pedido vem do mesmo IP),
// então a chave é o e-mail: 5 erros em 15 min travam aquele e-mail por 15 min.
// Em memória: reiniciar a API zera. Bom o bastante pra um servidor só.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

export class LoginLimiter {
  private fails = new Map<string, number[]>();
  constructor(private readonly now = () => Date.now()) {}

  private recent(key: string) {
    const cutoff = this.now() - WINDOW_MS;
    const list = (this.fails.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) this.fails.set(key, list);
    else this.fails.delete(key);
    return list;
  }

  /** Minutos até liberar, ou 0 se pode tentar. */
  blockedFor(key: string) {
    const list = this.recent(key);
    if (list.length < MAX_FAILS) return 0;
    return Math.ceil((list[0]! + WINDOW_MS - this.now()) / 60_000);
  }

  fail(key: string) { this.fails.set(key, [...this.recent(key), this.now()]); }
  reset(key: string) { this.fails.delete(key); }
}
