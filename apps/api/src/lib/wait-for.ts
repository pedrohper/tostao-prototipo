// Espera uma dependência (Postgres, Redis) ficar de pé antes de a API agendar crons e abrir a porta.
// No boot do servidor o pm2 sobe a API antes do Docker terminar de subir o banco ("the database system is starting up").

/** Rejeita se `promise` não resolver em `ms`. O trabalho que ficou pendurado é abandonado, não cancelado. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operação'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} passou de ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface WaitForOptions {
  /** Primeira espera; dobra a cada falha (1, 2, 4, 8 s…). */
  initialDelayMs?: number;
  /** Soma máxima das esperas. A última espera é encurtada pra fechar exatamente nesse teto. */
  maxTotalMs?: number;
  /** Teto de cada tentativa (o `check` pode ficar pendurado, por exemplo numa conexão que nunca responde). */
  attemptTimeoutMs?: number;
  /** Injetável pra testar sem esperar de verdade. */
  sleep?: (ms: number) => Promise<void>;
  log?: Pick<Console, 'info' | 'warn'>;
}

/**
 * Roda `check` até ele passar. Falhou: espera 1 s, depois 2, 4, 8… (somando no máximo `maxTotalMs`) e tenta de novo.
 * Estourou o teto: lança, e quem chamou decide sair com erro (o pm2 sobe a API de novo).
 */
export async function waitFor(name: string, check: () => Promise<unknown>, options: WaitForOptions = {}) {
  const {
    initialDelayMs = 1_000,
    maxTotalMs = 60_000,
    attemptTimeoutMs = 5_000,
    sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    log = console,
  } = options;

  let waited = 0;
  let delay = initialDelayMs;
  for (let attempt = 1; ; attempt++) {
    try {
      await withTimeout(Promise.resolve().then(check), attemptTimeoutMs, name);
      log.info(`[boot] ${name} ok${attempt > 1 ? ` (tentativa ${attempt})` : ''}`);
      return;
    } catch (err) {
      const reason = (err as Error).message;
      const remaining = maxTotalMs - waited;
      if (remaining <= 0) {
        throw new Error(`${name} não respondeu em ${attempt} tentativas (${Math.round(waited / 1000)} s): ${reason}`, {
          cause: err,
        });
      }
      const pause = Math.min(delay, remaining);
      log.warn(`[boot] ${name} indisponível (tentativa ${attempt}: ${reason}). Nova tentativa em ${pause / 1000} s`);
      await sleep(pause);
      waited += pause;
      delay *= 2;
    }
  }
}
