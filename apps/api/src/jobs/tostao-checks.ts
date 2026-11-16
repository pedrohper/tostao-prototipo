import { Cron } from 'croner';
import type { PushGateway } from '../gateways/push-gateway.js';
import type { WhatsAppGateway } from '../gateways/whatsapp-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { RunTostaoChecksUseCase } from '../use-cases/tostao-auto.js';

const URGENT_PATHS: Record<string, string> = {
  month_shortfall: '/tostao?aba=automatico',
  budget_alert: '/limites',
  tigrinho_bet_risk: '/batalha',
  due_soon: '/carteira',
};

/**
 * Roda periodicamente as rotinas automáticas do Tostão & Caramelo pra todos os usuários
 * com dados, atualizando achados e enviando avisos urgentes nos canais ligados.
 */
export async function runPeriodicTostaoChecks(
  repos: Repositories,
  opts: { push?: PushGateway; whatsapp?: WhatsAppGateway; now?: () => Date } = {},
) {
  const nowFn = opts.now ?? (() => new Date());
  const runner = new RunTostaoChecksUseCase(repos, nowFn);
  const userIds = await repos.users.listAllIds();
  let generated = 0;
  let notified = 0;

  for (const userId of userIds) {
    try {
      const res = await runner.execute({ userId });
      generated += res.generated;

      const urgent = res.insights.filter((i) => i.severity === 'urgent');
      if (!urgent.length) continue;

      const first = urgent[0]!;
      const claimKey = `insight-urgent:${first.id}`;

      if (opts.push?.enabled && res.config.notifyPush) {
        if (await repos.engagement.claimNotification(userId, `push:${claimKey}`)) {
          for (const sub of await repos.engagement.listPush(userId)) {
            const status = await opts.push.send(sub, {
              title: first.title,
              body: first.body,
              url: URGENT_PATHS[first.kind] ?? '/tostao?aba=automatico',
              tag: `tostao-${first.kind}`,
            });
            if (status === 'gone') await repos.engagement.deletePush(sub.endpoint);
            if (status === 'ok') notified++;
          }
        }
      }

      if (opts.whatsapp?.enabled && res.config.notifyWhatsapp) {
        const link = await repos.whatsapp.get(userId);
        if (link?.phone && (await repos.engagement.claimNotification(userId, `wa:${claimKey}`))) {
          await opts.whatsapp
            .send(link.phone, `*Tostão avisa:* ${first.title}\n${first.body}`)
            .then(() => { notified++; })
            .catch((err) => console.warn('[tostao-auto][wa]', (err as Error).message));
        }
      }
    } catch (err) {
      console.error('[tostao-auto] falhou pra um usuário:', (err as Error).message);
    }
  }

  return { users: userIds.length, generated, notified };
}

const checkJobs: Cron[] = [];

export function scheduleTostaoChecks(
  repos: Repositories,
  opts: { push?: PushGateway; whatsapp?: WhatsAppGateway } = {},
  log = console,
) {
  const job = new Cron('15 * * * *', { timezone: 'America/Sao_Paulo', protect: true }, async () => {
    try {
      const r = await runPeriodicTostaoChecks(repos, opts);
      if (r.generated > 0 || r.notified > 0) {
        log.info(`[tostao-auto] ${r.users} usuários verificados · ${r.generated} novos achados · ${r.notified} avisos`);
      }
    } catch (err) {
      log.error('[tostao-auto] cron falhou:', (err as Error).message);
    }
  });
  checkJobs.push(job);
  log.info(`[tostao-auto] rotinas automáticas agendadas (próximo: ${job.nextRun()?.toISOString() ?? '?'})`);
  return job;
}
