// T5.2: o miolo da materialização (sem agenda, sem lock): lança as recorrências vencidas e aplica no saldo os agendados.
// Idempotente por construção; veja jobs/recurring.ts pra a explicação das camadas de proteção.
import type { RecurringRule } from '../domain/entities.js';
import { civilDay } from '../lib/tz.js';
import type { Repositories } from '../repositories/types.js';
import { categorizeByRules } from './categorize.js';
import { dueAt, nextDay, occurrenceDescription, recurringExternalId } from './recurrence.js';
import { isManualAccount } from './manual-balance.js';
import { isNeutral } from '../use-cases/categories.js';

/** Teto de vencimentos por regra numa rodada (servidor ficou semanas parado: recupera aos poucos, sem travar). */
const MAX_STEPS_PER_RULE = 36;
const RULES_PER_BATCH = 500;
const PENDING_PER_BATCH = 500;
const MAX_BATCHES = 40;

export type Log = Pick<Console, 'info' | 'error' | 'warn'>;
export type MaterializeResult = { posted: number; applied: number };

/** Passo 1. `userId` restringe a uma pessoa (usado ao criar uma regra com vencimento já chegado). */
export async function materializeDueRules(
  repos: Repositories,
  now: Date,
  opts: { userId?: string; log?: Log } = {},
): Promise<number> {
  const log = opts.log ?? console;
  let posted = 0;
  const tzCache = new Map<string, string>();
  const tzOf = async (userId: string) => {
    let tz = tzCache.get(userId);
    if (!tz) {
      tz = (await repos.users.findById(userId))?.timezone ?? 'America/Sao_Paulo';
      tzCache.set(userId, tz);
    }
    return tz;
  };

  // Uma "página" por vez: regra que ficou pra trás é reprocessada na próxima volta, até acabar (ou bater o teto de lotes).
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const due = await repos.recurring.listDue(now, RULES_PER_BATCH, opts.userId);
    if (due.length === 0) break;
    let progressed = false;
    for (const rule of due) {
      try {
        const n = await materializeRule(repos, rule, now, await tzOf(rule.userId));
        posted += n.posted;
        progressed ||= n.advanced;
      } catch (err) {
        log.error(`[recorrencias] regra ${rule.id} falhou:`, (err as Error).message);
      }
    }
    if (!progressed) break; // ninguém avançou (tudo falhou ou outra execução venceu): não gira à toa
  }
  return posted;
}

/** Lança todos os vencimentos já chegados de UMA regra (até o teto). */
async function materializeRule(repos: Repositories, rule: RecurringRule, now: Date, tz: string) {
  let current = rule;
  let posted = 0;
  let advanced = false;
  for (let step = 0; step < MAX_STEPS_PER_RULE && current.active && current.nextRunAt <= now; step++) {
    const day = civilDay(current.nextRunAt, tz);
    const occurrence = current.postedInstallments + 1;
    const finished = current.totalInstallments !== null && occurrence >= current.totalInstallments;
    const nextRunAt = finished ? current.nextRunAt : dueAt(nextDay(current, day), tz);
    const step1 = current; // o que a transação precisa enxergar (closure estável)
    const result = await repos.tx(async (r) => {
      const won = await r.recurring.advance(step1.id, step1.nextRunAt, {
        nextRunAt,
        postedInstallments: occurrence,
        active: !finished,
      });
      if (!won) return null; // outra execução já avançou esta regra: não lança de novo
      const account = step1.accountId
        ? (await r.accounts.listByUser(step1.userId)).find((a) => a.id === step1.accountId)
        : null;
      const categoryId =
        step1.categoryId ?? categorizeByRules(step1.description, await r.rules.listForUser(step1.userId));
      const signed = (step1.kind === 'saida' ? -1 : 1) * step1.amountInCents;
      const manual = !!account && isManualAccount(account);
      const created = await r.transactions.createMany(
        [
          {
            userId: step1.userId,
            accountId: account?.id ?? null,
            externalId: recurringExternalId(step1, day),
            description: occurrenceDescription(step1, occurrence),
            amountInCents: signed,
            occurredAt: step1.nextRunAt,
            categoryId,
            isInternalTransfer: isNeutral(categoryId),
            seriesId: null,
            settledAt: now,
            // Já venceu (nextRunAt <= agora): em conta manual pesa no saldo agora, junto com o lançamento.
            balanceAppliedAt: manual ? now : null,
          },
        ],
        { skipDuplicates: true },
      );
      // `created === 0`: o lançamento deste vencimento já existia (outra rodada, ou a pessoa já anotou igual): só avança.
      if (created === 1 && manual) await r.accounts.adjustBalance(account!.id, signed);
      return { created };
    });
    if (!result) break;
    advanced = true;
    posted += result.created;
    current = { ...current, nextRunAt, postedInstallments: occurrence, active: !finished };
  }
  return { posted, advanced };
}

/** Passo 2: aplica no saldo os lançamentos de conta manual cuja data chegou e que ainda não pesaram. */
export async function applyDueScheduledBalances(repos: Repositories, now: Date, log: Log = console): Promise<number> {
  let applied = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const pending = await repos.transactions.findBalancePending(now, PENDING_PER_BATCH);
    if (pending.length === 0) break;
    let claimedInBatch = 0;
    for (const t of pending) {
      try {
        const won = await repos.tx(async (r) => {
          // A trava e o saldo na mesma transação: ou os dois, ou nenhum. Só quem ganha a trava mexe no saldo.
          if (!(await r.transactions.claimBalanceApplication(t.id, now))) return false;
          await r.accounts.adjustBalance(t.accountId!, t.amountInCents);
          return true;
        });
        if (won) {
          applied++;
          claimedInBatch++;
        }
      } catch (err) {
        log.error(`[recorrencias] agendado ${t.id} falhou:`, (err as Error).message);
      }
    }
    if (claimedInBatch === 0) break;
  }
  return applied;
}
