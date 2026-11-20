// Fila de tarefas pendentes (tabela outbox_jobs). Hoje só tem um tipo: desligar um Item no Pluggy quando o provedor
// estava fora do ar na hora em que a pessoa desconectou o banco ou apagou a conta. Roda dentro da API (croner)
// até a Fase 3 trocar por um worker dedicado; a tabela e o contrato continuam os mesmos.
import { Cron } from 'croner';
import type { BankGateway } from '../gateways/bank-gateway.js';
import type { Repositories } from '../repositories/types.js';
import type { OutboxJob } from '../domain/entities.js';

const MINUTE = 60_000;
/** Espera entre tentativas: 5 min, 10, 20... até no máximo 6 h. */
export const backoffMs = (attempts: number) => Math.min(5 * MINUTE * 2 ** Math.max(0, attempts - 1), 6 * 60 * MINUTE);

async function handle(job: OutboxJob, bank: BankGateway) {
  if (job.type === 'pluggy.deleteItem') {
    const itemId = job.payload.itemId;
    if (typeof itemId !== 'string' || !itemId) throw new Error('payload sem itemId');
    await bank.deleteItem(itemId);
    return;
  }
  throw new Error(`tipo de job desconhecido: ${String(job.type)}`);
}

/** Processa os jobs vencidos. Cada job é travado antes (claimDue), então dois processos nunca fazem o mesmo. */
export async function processOutbox(
  repos: Pick<Repositories, 'outbox'>,
  bank: BankGateway,
  {
    now = () => new Date(),
    limit = 20,
    log = console,
  }: { now?: () => Date; limit?: number; log?: Pick<Console, 'info' | 'error'> } = {},
) {
  const result = { done: 0, retried: 0, failed: 0 };
  for (const job of await repos.outbox.claimDue(now(), limit)) {
    try {
      await handle(job, bank);
      await repos.outbox.markDone(job.id, now());
      result.done++;
    } catch (err) {
      const message = (err as Error).message ?? 'erro';
      if (job.attempts >= job.maxAttempts) {
        await repos.outbox.markAttemptFailed(job.id, message, null);
        result.failed++;
        // Sem o payload no log: não vaza id de Item.
        log.error(`[outbox] ${job.type} desistiu após ${job.attempts} tentativas: ${message}`);
      } else {
        await repos.outbox.markAttemptFailed(job.id, message, new Date(now().getTime() + backoffMs(job.attempts)));
        result.retried++;
      }
    }
  }
  return result;
}

export function scheduleOutbox(
  repos: Pick<Repositories, 'outbox'>,
  bank: BankGateway,
  log: Pick<Console, 'info' | 'error'> = console,
) {
  const job = new Cron('*/5 * * * *', { protect: true }, async () => {
    try {
      const r = await processOutbox(repos, bank, { log });
      if (r.done || r.retried || r.failed)
        log.info(`[outbox] ${r.done} feitos, ${r.retried} a repetir, ${r.failed} desistidos`);
    } catch (err) {
      log.error('[outbox] falhou:', (err as Error).message);
    }
  });
  log.info(`[outbox] agendado. Próximo: ${job.nextRun()?.toISOString() ?? '?'}`);
  return job;
}
