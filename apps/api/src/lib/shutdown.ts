// Desligamento limpo em SIGTERM/SIGINT. O pm2 manda SIGTERM no stop/restart e espera `kill_timeout` antes do SIGKILL.
// Sem isto, crons, sync e conexões do Prisma/Redis eram cortados no meio.

export interface ShutdownStep {
  name: string;
  run: () => unknown | Promise<unknown>;
}

export interface ShutdownOptions {
  /** Rodam na ordem, uma de cada vez. Um passo que falha não impede os seguintes. */
  steps: ShutdownStep[];
  /** Passou disso, sai com código 1 mesmo que algum passo ainda esteja pendurado. */
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: Pick<Console, 'info' | 'error'>;
}

/**
 * Devolve o handler do sinal. Primeiro sinal: roda os passos e sai (0 se todos passaram, 1 se algum falhou ou se
 * estourou o tempo). Segundo sinal com o desligamento em curso: força a saída na hora.
 */
export function createShutdown({ steps, timeoutMs = 10_000, exit = process.exit, log = console }: ShutdownOptions) {
  let started = false;

  return async function shutdown(signal: string): Promise<void> {
    if (started) {
      log.error(`[shutdown] ${signal} de novo: forçando a saída`);
      exit(1);
      return;
    }
    started = true;
    log.info(`[shutdown] ${signal} recebido: desligando (limite de ${timeoutMs / 1000} s)`);

    let failed = false;
    const timer = setTimeout(() => {
      log.error(`[shutdown] passou de ${timeoutMs / 1000} s: saindo à força`);
      exit(1);
    }, timeoutMs);

    for (const step of steps) {
      try {
        await step.run();
        log.info(`[shutdown] ${step.name} ok`);
      } catch (err) {
        failed = true;
        log.error(`[shutdown] ${step.name} falhou:`, (err as Error).message);
      }
    }

    clearTimeout(timer);
    exit(failed ? 1 : 0);
  };
}

/** Liga o handler em SIGTERM e SIGINT. `proc` é injetável pra teste. */
export function installShutdown(
  options: ShutdownOptions,
  proc: Pick<NodeJS.Process, 'on'> = process,
): (signal: string) => Promise<void> {
  const shutdown = createShutdown(options);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    proc.on(signal, () => void shutdown(signal));
  }
  return shutdown;
}
