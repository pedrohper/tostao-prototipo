// Sincronização automática: todo dia de manhã, puxa o extrato de todo mundo.
// Atalho do protótipo: roda dentro do próprio processo da API (croner). Em produção, vira um worker separado ou um cron do provedor.
import { Cron } from 'croner';
import type { Repositories } from '../repositories/types.js';
import type { SyncBankConnectionUseCase } from '../use-cases/sync-bank-connection.js';

export async function syncAllConnections(repos: Repositories, sync: SyncBankConnectionUseCase, log = console) {
  const connections = await repos.connections.listActive();
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

export function scheduleDailySync(pattern: string, run: () => Promise<unknown>) {
  return new Cron(pattern, { timezone: 'America/Sao_Paulo', protect: true }, async () => { await run(); });
}
