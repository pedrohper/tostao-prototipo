import type { Repositories } from '../repositories/types.js';
import type { PushGateway, PushPayload } from '../gateways/push-gateway.js';
import { brDay, EngagementUseCase } from '../use-cases/engagement.js';

const money = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const BR = 3 * 60 * 60 * 1000;

/**
 * Roda a cada 15 min. Cada aviso tem uma chave e sai uma vez só:
 * - 9h: o que vence hoje ou daqui a 2 dias (fatura, conta fixa, assinatura)
 * - 20h: ofensiva em risco (tem ofensiva e hoje nenhuma missão)
 * - domingo 19h: resumo da semana
 */
export async function runNotifications(repos: Repositories, push: PushGateway, now = new Date()) {
  if (!push.enabled) return { sent: 0 };
  const engagement = new EngagementUseCase(repos, () => now);
  const br = new Date(now.getTime() - BR);
  const hour = br.getUTCHours();
  const today = brDay(now);
  let sent = 0;

  const deliver = async (userId: string, key: string, payload: PushPayload) => {
    if (!(await repos.engagement.claimNotification(userId, key))) return;
    for (const sub of await repos.engagement.listPush(userId)) {
      const r = await push.send(sub, payload);
      if (r === 'gone') await repos.engagement.deletePush(sub.endpoint);
      if (r === 'ok') sent++;
    }
  };

  for (const userId of await repos.engagement.listPushUserIds()) {
    try {
      if (hour >= 9) {
        const { reminders } = await engagement.reminders(userId, 2);
        const due = reminders.filter((r) => r.daysLeft === 0 || r.daysLeft === 2);
        if (due.length) {
          const first = due[0]!;
          const when = first.daysLeft === 0 ? 'Vence hoje' : 'Vence em 2 dias';
          const rest = due.length > 1 ? ` e mais ${due.length - 1}` : '';
          await deliver(userId, `vence:${today}`, {
            title: `${when}: ${first.title}${first.amountInCents ? ` (${money(first.amountInCents)})` : ''}`,
            body: `${due.length > 1 ? `Tem${rest} conta chegando.` : 'Só pra não pegar de surpresa.'} Toca pra ver o que vence nos próximos dias.`,
            url: '/inicio#vence',
            tag: 'vence',
          });
        }
      }
      if (hour >= 20) {
        const m = await engagement.missions(userId);
        if (m.streakDays > 0 && !m.todayKept) {
          await deliver(userId, `ofensiva:${today}`, {
            title: `Sua ofensiva de ${m.streakDays} ${m.streakDays === 1 ? 'dia' : 'dias'} acaba hoje`,
            body: `Uma missão salva: ${m.missions.find((x) => !x.done)?.title.toLowerCase() ?? 'faz uma lição rapidinha'}.`,
            url: '/aprender',
            tag: 'ofensiva',
          });
        }
      }
      if (br.getUTCDay() === 0 && hour >= 19) {
        const w = await engagement.weekly(userId);
        const diff = w.spentInCents - w.prevSpentInCents;
        await deliver(userId, `semana:${today}`, {
          title: `Sua semana: saiu ${money(w.spentInCents)}`,
          body: w.prevSpentInCents
            ? `${diff <= 0 ? `${money(-diff)} a menos` : `${money(diff)} a mais`} que na semana anterior.${w.top ? ` Onde mais foi: ${w.top.name}.` : ''}`
            : `${w.missionsDone} missões feitas na semana.`,
          url: '/inicio#semana',
          tag: 'semana',
        });
      }
    } catch (err) {
      console.error('[avisos] falhou pra um usuário:', (err as Error).message);
    }
  }
  return { sent };
}

export function scheduleNotifications(repos: Repositories, push: PushGateway) {
  if (!push.enabled) return;
  const tick = () => runNotifications(repos, push).catch((err) => console.error('[avisos]', (err as Error).message));
  setInterval(tick, 15 * 60 * 1000);
  setTimeout(tick, 30 * 1000);
}
