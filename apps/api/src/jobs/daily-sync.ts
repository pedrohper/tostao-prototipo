// Sincronização automática: todo dia de manhã, puxa o extrato de todo mundo.
// Atalho de desenvolvimento: roda dentro do próprio processo da API (croner). Em produção, vira um worker separado ou um cron do provedor.
import { Cron } from 'croner';
import type { Repositories } from '../repositories/types.js';
import type { SyncBankConnectionUseCase } from '../use-cases/sync-bank-connection.js';

/** Espera mínima entre uma falha e a próxima tentativa automática. */
export const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

/** Só Item de verdade (Open Finance) tem o que sincronizar. */
const hasProvider = (itemId: string) => !itemId.startsWith('import:') && !itemId.startsWith('manual:');

export async function syncAllConnections(repos: Repositories, sync: SyncBankConnectionUseCase, log = console) {
  // Conexões saudáveis + as que deram erro há 24 h ou mais (3 falhas seguidas viram RECONNECT_REQUIRED e saem da fila).
  // Import e conta manual não têm provedor: nunca entram (antes um restart disparava sync de "conexões" que não existem).
  const retryBefore = new Date(Date.now() - RETRY_AFTER_MS);
  const connections = [
    ...(await repos.connections.listActive()),
    ...(await repos.connections.listRetryable(retryBefore)),
  ].filter((c) => hasProvider(c.itemId));
  for (const c of connections) {
    try {
      const r = await sync.execute({ connectionId: c.id });
      log.info(`[sync] ${c.id}: ${r.importedCount} novas, ${r.reconciledCount ?? 0} anotações confirmadas`);
    } catch (err) {
      log.error(`[sync] ${c.id} falhou:`, (err as Error).message);
    }
  }
  return connections.length;
}

/**
 * Agenda o sync. Guarda a referência (o croner pode ser coletado se ninguém segurar o job),
 * loga cada disparo e o próximo horário, e não deixa um erro derrubar os próximos.
 */
export function scheduleDailySync(pattern: string, run: () => Promise<unknown>, log = console) {
  const job = new Cron(pattern, { timezone: 'America/Sao_Paulo', protect: true }, async () => {
    log.info(`[sync] início (${new Date().toISOString()})`);
    try {
      await run();
    } catch (err) {
      log.error('[sync] falhou:', (err as Error).message);
    }
    log.info(`[sync] fim. Próximo: ${job.nextRun()?.toISOString() ?? '?'}`);
  });
  scheduled.push(job);
  log.info(`[sync] agendado (${pattern}). Próximo: ${job.nextRun()?.toISOString() ?? '?'}`);
  return job;
}
const scheduled: Cron[] = [];

/** Quem não sincroniza há mais que `maxAgeMs` (ex.: o servidor ficou desligado na hora do cron). */
export async function isSyncStale(repos: Repositories, maxAgeMs: number, now = new Date()) {
  const last = (await repos.connections.listActive())
    .filter((c) => hasProvider(c.itemId))
    .map((c) => c.lastSyncedAt?.getTime() ?? 0);
  return last.length > 0 && Math.min(...last) < now.getTime() - maxAgeMs;
}
