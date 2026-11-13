// Sincronização automática: todo dia de manhã, puxa o extrato de todo mundo.
// Atalho do protótipo: roda dentro do próprio processo da API (croner). Em produção, vira um worker separado ou um cron do provedor.
import { Cron } from 'croner';
import type { Repositories } from '../repositories/types.js';
import type { SyncBankConnectionUseCase } from '../use-cases/sync-bank-connection.js';

export async function syncAllConnections(repos: Repositories, sync: SyncBankConnectionUseCase, log = console) {
  const connections = (await repos.connections.listActive()).filter((c) => !c.itemId.startsWith('import:'));
  for (const c of connections) {
    try {
      const r = await sync.execute({ connectionId: c.id });
      log.info(`[sync] ${c.id}: ${r.importedCount} novas`);
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
    try { await run(); } catch (err) { log.error('[sync] falhou:', (err as Error).message); }
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
    .filter((c) => !c.itemId.startsWith('import:'))
    .map((c) => c.lastSyncedAt?.getTime() ?? 0);
  return last.length > 0 && Math.min(...last) < now.getTime() - maxAgeMs;
}
