// T5.2: materialização diária de recorrências e de lançamentos agendados.
//
// Dois passos, nesta ordem, sempre idempotentes (rodar duas vezes no mesmo dia não duplica nada):
//   1. RECORRÊNCIAS: cada regra vencida (nextRunAt <= agora) vira UM lançamento por vencimento. A identidade é o
//      `externalId` determinístico `rec:<regra>:<AAAA-MM>` (único por pessoa no Postgres), e o avanço da regra é um UPDATE
//      condicional ("só avança se ainda estiver neste vencimento"). Lançamento + saldo + avanço entram na MESMA transação.
//   2. AGENDADOS: lançamento de conta manual com data futura não pesa no saldo quando é criado (T1.5). Quando a data chega,
//      este passo aplica o saldo, uma única vez, pela trava `balanceAppliedAt` (UPDATE condicional).
//
// Proteção em camadas: lock distribuído no Redis (evita trabalho duplicado entre réplicas) → UPDATE condicional (decide
// quem lança) → UNIQUE(userId, externalId) com skipDuplicates (última barreira). O lock é conforto; a correção é do Postgres.
//
// Roda dentro do processo da API (croner, igual ao daily-sync). Quando a Fase 3 (worker BullMQ) existir, é só chamar
// `materializeAll` de lá: nada aqui depende do Fastify.
import { Cron } from 'croner';
import { withLock } from '../lib/lock.js';
import type { KeyValueStore } from '../lib/redis.js';
import type { Repositories } from '../repositories/types.js';
import {
  applyDueScheduledBalances,
  materializeDueRules,
  type Log,
  type MaterializeResult,
} from '../services/recurring-materializer.js';

/** Trava de uma rodada (Redis). 10 min: bem mais que uma rodada normal, e expira sozinha se o processo morrer. */
export const RECURRING_LOCK_KEY = 'lock:recurring-materialize';
const LOCK_TTL_SECONDS = 600;

/** Os dois passos, com lock. `ran: false` = outra instância está rodando agora. */
export async function materializeAll(
  repos: Repositories,
  kv: KeyValueStore,
  now: Date = new Date(),
  log: Log = console,
): Promise<{ ran: boolean } & Partial<MaterializeResult>> {
  const r = await withLock(
    kv,
    RECURRING_LOCK_KEY,
    LOCK_TTL_SECONDS,
    async () => ({
      posted: await materializeDueRules(repos, now, { log }),
      applied: await applyDueScheduledBalances(repos, now, log),
    }),
    log,
  );
  if (!r.ran) return { ran: false };
  if (r.value.posted || r.value.applied)
    log.info(
      `[recorrencias] ${r.value.posted} lançamento(s) criado(s), ${r.value.applied} agendado(s) aplicado(s) no saldo`,
    );
  return { ran: true, ...r.value };
}

/**
 * Agenda a rodada. A cada hora por padrão (`5 * * * *`): cada pessoa tem o meio-dia dela num horário diferente do
 * relógio, e como a rodada é idempotente, rodar toda hora é seguro e o vencimento nunca espera mais que 1 h.
 * `protect: true` impede a rodada de se sobrepor a si mesma; `scheduled` segura a referência (o croner pode ser coletado).
 */
export function scheduleRecurring(pattern: string, run: () => Promise<unknown>, log: Log = console) {
  const job = new Cron(pattern, { timezone: 'America/Sao_Paulo', protect: true }, async () => {
    try {
      await run();
    } catch (err) {
      log.error('[recorrencias] falhou:', (err as Error).message);
    }
  });
  scheduled.push(job);
  log.info(`[recorrencias] agendado (${pattern}). Próximo: ${job.nextRun()?.toISOString() ?? '?'}`);
  return job;
}
const scheduled: Cron[] = [];
