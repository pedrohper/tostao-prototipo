import { randomBytes } from 'node:crypto';
import type {
  FriendDTO,
  FriendRequestDTO,
  FriendsResponse,
  MissionDTO,
  MissionsResponse,
  ReminderDTO,
  WeeklyResponse,
} from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { AppError, ConflictError, ResourceNotFoundError } from '../domain/errors.js';
import {
  addCivilDays,
  calendarDay,
  civilDay,
  DEFAULT_TIMEZONE,
  diffCivilDays,
  endOfCivilDay,
  startOfCivilDay,
} from '../lib/tz.js';
import { timezoneOf } from '../lib/user-tz.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';
import { nextDueDate } from './get-month-summary.js';

const DAY = 24 * 60 * 60 * 1000;
/** Dia civil no fuso (padrão Brasília), como "2026-11-12". */
export const brDay = (d: Date, tz: string = DEFAULT_TIMEZONE) => civilDay(d, tz);
const addDays = addCivilDays;
/** Segunda-feira da semana do dia. */
export const weekStart = (day: string) => {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(day, dow === 0 ? -6 : 1 - dow);
};

/**
 * Ofensiva = dias seguidos com pelo menos uma missão, contando até hoje.
 * Se hoje ainda não teve, a de ontem continua valendo (só quebra amanhã).
 */
export function streakFromDays(days: Set<string>, now: Date, tz: string = DEFAULT_TIMEZONE) {
  const today = brDay(now, tz);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

type MissionDef = { id: string; title: string; href: string; kinds: string[] };
const FIXED: MissionDef[] = [
  { id: 'licao', title: 'Fazer 1 lição', href: '/aprender', kinds: ['licao'] },
  {
    id: 'gastos',
    title: 'Anotar ou categorizar 1 gasto',
    href: '/carteira?filtro=pendentes',
    kinds: ['categorizar', 'anotar'],
  },
];
/** A terceira missão muda todo dia. */
export const DAILY: MissionDef[] = [
  { id: 'previsao', title: 'Ver quanto sobra até o fim do mês', href: '/previsao', kinds: ['visita:previsao'] },
  {
    id: 'assinaturas',
    title: 'Dar uma olhada nas assinaturas',
    href: '/assinaturas',
    kinds: ['visita:assinaturas', 'assinaturas'],
  },
  { id: 'tribunal', title: 'Votar no caso do Tribunal', href: '/tribunal', kinds: ['tribunal'] },
  { id: 'limites', title: 'Conferir os limites do mês', href: '/limites', kinds: ['visita:limites', 'limites'] },
  { id: 'chat', title: 'Perguntar uma coisa pro Tostão', href: '/tostao', kinds: ['chat'] },
  { id: 'meta', title: 'Guardar qualquer valor na meta', href: '/meta', kinds: ['meta'] },
  { id: 'fechamento', title: 'Abrir o fechamento do mês', href: '/fechamento', kinds: ['visita:fechamento'] },
];
export const missionsFor = (day: string): MissionDef[] => {
  const n = Math.floor(Date.parse(`${day}T12:00:00Z`) / DAY);
  return [...FIXED, DAILY[n % DAILY.length]!];
};
const doneCount = (day: string, kinds: Set<string>) =>
  missionsFor(day).filter((m) => m.kinds.some((k) => kinds.has(k))).length;

function byDay(rows: { day: string; kind: string }[]) {
  const map = new Map<string, Set<string>>();
  for (const r of rows) map.set(r.day, (map.get(r.day) ?? new Set()).add(r.kind));
  return map;
}

/**
 * XP das missões: 5 por missão do dia que foi feita (lição e Tribunal já dão XP próprio, ficam de fora).
 * Conta MISSÕES que existem naquele dia, não linhas de atividade: um tipo inventado ou uma missão que não é do dia
 * não rende XP (antes, cada linha extra valia 5 XP e dava pra "plantar" XP).
 */
export const missionXp = (rows: { day: string; kind: string }[]) => {
  const kindsByDay = byDay(rows);
  let xp = 0;
  for (const [day, kinds] of kindsByDay) {
    xp +=
      missionsFor(day).filter(
        (m) => !m.kinds.every((k) => k === 'licao' || k === 'tribunal') && m.kinds.some((k) => kinds.has(k)),
      ).length * 5;
  }
  return xp;
};

export class EngagementUseCase {
  constructor(
    private readonly repos: Repositories,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async track(userId: string, kind: string) {
    const tz = await timezoneOf(this.repos.users, userId);
    return this.repos.engagement.markActivity(userId, brDay(this.now(), tz), kind);
  }

  /** Ofensiva + placar da semana de uma pessoa (o que amigo pode ver: nada de dinheiro). */
  async score(userId: string) {
    const now = this.now();
    const tz = await timezoneOf(this.repos.users, userId);
    const today = brDay(now, tz);
    const [rows, lessons] = await Promise.all([
      this.repos.engagement.listActivity(userId, addDays(today, -400)),
      this.repos.lessons.listByUser(userId),
    ]);
    const days = byDay(rows);
    const monday = weekStart(today);
    let weekScore = 0;
    for (let d = monday; d <= today; d = addDays(d, 1)) weekScore += doneCount(d, days.get(d) ?? new Set());
    // Ofensiva = dias com qualquer missão OU lição concluída: a MESMA conta da tela de Aprender (ListLessonProgress).
    const streakDays = streakFromDays(
      new Set([...days.keys(), ...lessons.map((l) => brDay(l.completedAt, tz))]),
      now,
      tz,
    );
    return { streakDays, weekScore, days, today, monday, tz };
  }

  async missions(userId: string): Promise<MissionsResponse> {
    const { streakDays, days, today, monday } = await this.score(userId);
    const kinds = days.get(today) ?? new Set<string>();
    const missions: MissionDTO[] = missionsFor(today).map((m) => ({
      id: m.id,
      title: m.title,
      href: m.href,
      done: m.kinds.some((k) => kinds.has(k)),
    }));
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(monday, i);
      return { day, done: day > today ? 0 : doneCount(day, days.get(day) ?? new Set()) };
    });
    return { missions, streakDays, todayKept: kinds.size > 0, week };
  }

  // ---------- amigos ----------
  async friendCode(userId: string) {
    const existing = await this.repos.engagement.getFriendCode(userId);
    if (existing) return existing;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 5; i++) {
      const code = `TOST-${[...randomBytes(5)].map((b) => alphabet[b % alphabet.length]).join('')}`;
      if (!(await this.repos.engagement.findUserByFriendCode(code))) {
        await this.repos.engagement.setFriendCode(userId, code);
        return code;
      }
    }
    throw new AppError('Não consegui gerar seu código agora. Tenta de novo?', 500);
  }

  async friends(userId: string): Promise<FriendsResponse> {
    const [code, ids, incoming, outgoing, tz] = await Promise.all([
      this.friendCode(userId),
      this.repos.engagement.listFriendIds(userId),
      this.repos.engagement.listIncomingFriendRequests(userId),
      this.repos.engagement.listOutgoingFriendRequests(userId),
      timezoneOf(this.repos.users, userId),
    ]);
    const people = await Promise.all(
      [userId, ...ids].map(async (id): Promise<FriendDTO | null> => {
        const u = await this.repos.users.findById(id);
        if (!u) return null;
        const s = await this.score(id);
        return {
          id,
          name: u.name.trim().split(/\s+/)[0] ?? u.name,
          streakDays: s.streakDays,
          weekScore: s.weekScore,
          me: id === userId,
        };
      }),
    );
    const ranking = people
      .filter((p): p is FriendDTO => p !== null)
      .sort((a, b) => b.weekScore - a.weekScore || b.streakDays - a.streakDays);
    const sunday = addDays(weekStart(brDay(this.now(), tz)), 6);
    const toDto = async (id: string, requestId: string, createdAt: Date): Promise<FriendRequestDTO | null> => {
      const u = await this.repos.users.findById(id);
      return u
        ? { id: requestId, name: u.name.trim().split(/\s+/)[0] ?? u.name, createdAt: createdAt.toISOString() }
        : null;
    };
    const nonNull = (list: (FriendRequestDTO | null)[]) => list.filter((r): r is FriendRequestDTO => r !== null);
    return {
      code,
      challenge: {
        title: 'Quem cumpre mais missões na semana',
        endsAt: endOfCivilDay(startOfCivilDay(sunday, tz), tz).toISOString(),
      },
      ranking,
      requests: {
        incoming: nonNull(await Promise.all(incoming.map((r) => toDto(r.requesterId, r.id, r.createdAt)))),
        outgoing: nonNull(await Promise.all(outgoing.map((r) => toDto(r.addresseeId, r.id, r.createdAt)))),
      },
    };
  }

  /**
   * Usar o código de alguém MANDA UM PEDIDO (a outra pessoa precisa aceitar): ninguém entra no ranking nem
   * vê a ofensiva de quem não aceitou. Se a outra pessoa já tinha pedido pra você, o pedido dela é aceito na hora.
   */
  async addFriend(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, '');
    const friendId = await this.repos.engagement.findUserByFriendCode(code);
    if (!friendId) throw new AppError('Não achei ninguém com esse código. Confere com seu amigo?', 404);
    if (friendId === userId) throw new AppError('Esse é o seu próprio código.', 400);
    if ((await this.repos.engagement.listFriendIds(userId)).includes(friendId)) return this.friends(userId);

    const reverse = await this.repos.engagement.findFriendRequest(friendId, userId);
    if (reverse && reverse.requesterId === friendId && reverse.status === 'PENDING') {
      await this.repos.engagement.respondFriendRequest(reverse.id, userId, true, this.now());
      return this.friends(userId);
    }
    const { request, created } = await this.repos.engagement.createFriendRequest(userId, friendId);
    if (!created && request.status === 'PENDING')
      throw new ConflictError('Você já mandou um pedido pra essa pessoa. Agora é esperar ela aceitar.');
    return this.friends(userId);
  }

  /** Aceitar ou recusar um pedido que a pessoa RECEBEU. Pedido de outra pessoa, já respondido ou inexistente: 404. */
  async respondRequest(userId: string, requestId: string, accept: boolean) {
    const done = await this.repos.engagement.respondFriendRequest(requestId, userId, accept, this.now());
    if (!done) throw new ResourceNotFoundError('Pedido de amizade');
    return this.friends(userId);
  }

  async removeFriend(userId: string, friendId: string) {
    await this.repos.engagement.removeFriend(userId, friendId);
    return this.friends(userId);
  }

  // ---------- avisos ----------
  /** Faturas, contas fixas e assinaturas que vencem nos próximos `days` dias. */
  async reminders(userId: string, days = 7): Promise<{ reminders: ReminderDTO[] }> {
    const now = this.now();
    const tz = await timezoneOf(this.repos.users, userId);
    const today = brDay(now, tz);
    const [accounts, plan, subs] = await Promise.all([
      this.repos.accounts.listByUser(userId),
      this.repos.plans.get(userId),
      new ListSubscriptionsUseCase(this.repos, () => now).execute({ userId }),
    ]);
    const diff = (iso: string) => diffCivilDays(today, iso.slice(0, 10));
    const out: ReminderDTO[] = [];
    for (const a of accounts) {
      if (a.type !== 'CREDIT' || a.hidden || !a.dueDate) continue;
      // O vencimento é uma data de calendário (o Pluggy manda a fatura anterior às vezes): rola pro próximo de verdade.
      const due = calendarDay(nextDueDate(a.dueDate, now));
      const owed = Math.max(0, -a.balanceInCents);
      if (owed > 0)
        out.push({
          key: `fatura:${a.id}:${due}`,
          kind: 'fatura',
          title: `Fatura ${a.name}`,
          amountInCents: owed,
          dueDate: due,
          daysLeft: diff(due),
        });
    }
    for (const f of plan?.fixedExpenses ?? []) {
      const [y, m] = today.split('-').map(Number) as [number, number];
      for (const k of [0, 1]) {
        const last = new Date(Date.UTC(y, m - 1 + k + 1, 0)).getUTCDate();
        const d = new Date(Date.UTC(y, m - 1 + k, Math.min(f.day, last), 12)).toISOString().slice(0, 10);
        if (d >= today) {
          out.push({
            key: `conta:${f.name}:${d}`,
            kind: 'conta',
            title: f.name,
            amountInCents: f.amountInCents,
            dueDate: d,
            daysLeft: diff(d),
          });
          break;
        }
      }
    }
    for (const s of subs.subscriptions) {
      if (!s.active) continue;
      const d = brDay(new Date(s.nextChargeAt), tz);
      out.push({
        key: `assinatura:${s.key}:${d}`,
        kind: 'assinatura',
        title: s.name,
        amountInCents: s.amountInCents,
        dueDate: d,
        daysLeft: diff(d),
      });
    }
    return {
      reminders: out
        .filter((r) => r.daysLeft >= 0 && r.daysLeft <= days)
        .sort((a, b) => a.daysLeft - b.daysLeft || (b.amountInCents ?? 0) - (a.amountInCents ?? 0)),
    };
  }

  // ---------- resumo da semana ----------
  /** Últimos 7 dias contra os 7 anteriores (gasto de verdade: sem transferência entre contas e sem conta oculta). */
  async weekly(userId: string): Promise<WeeklyResponse> {
    const now = this.now();
    const tz = await timezoneOf(this.repos.users, userId);
    const today = brDay(now, tz);
    const from = addDays(today, -6);
    const prevFrom = addDays(today, -13);
    const start = startOfCivilDay(prevFrom, tz);
    const [txs, accounts, categories, score] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, start, new Date(now.getTime() + DAY)),
      this.repos.accounts.listByUser(userId),
      this.repos.categories.list(userId),
      this.score(userId),
    ]);
    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
    const cats = new Map(categories.map((c) => [c.id, c.name]));
    let spent = 0,
      prev = 0;
    const byCat = new Map<string | null, number>();
    for (const t of txs) {
      if (t.amountInCents >= 0 || t.isInternalTransfer || (t.accountId && hidden.has(t.accountId))) continue;
      const d = brDay(t.occurredAt, tz);
      if (d >= from && d <= today) {
        spent -= t.amountInCents;
        byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) - t.amountInCents);
      } else if (d >= prevFrom && d < from) prev -= t.amountInCents;
    }
    const topEntry = [...byCat].sort((a, b) => b[1] - a[1])[0];
    let missionsDone = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) missionsDone += doneCount(d, score.days.get(d) ?? new Set());
    return {
      from,
      to: today,
      spentInCents: spent,
      prevSpentInCents: prev,
      top: topEntry
        ? {
            categoryId: topEntry[0],
            name: topEntry[0] ? (cats.get(topEntry[0]) ?? 'Outros') : 'Sem categoria',
            totalInCents: topEntry[1],
          }
        : null,
      missionsDone,
      streakDays: score.streakDays,
    };
  }
}
