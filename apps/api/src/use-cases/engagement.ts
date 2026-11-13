import { randomBytes } from 'node:crypto';
import type { FriendDTO, FriendsResponse, MissionDTO, MissionsResponse, ReminderDTO, WeeklyResponse } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { AppError } from '../domain/errors.js';
import { ListSubscriptionsUseCase } from './list-subscriptions.js';

const DAY = 24 * 60 * 60 * 1000;
const BR = 3 * 60 * 60 * 1000;
/** Dia em Brasília (UTC−3), como "2026-11-12". */
export const brDay = (d: Date) => new Date(d.getTime() - BR).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
/** Segunda-feira da semana do dia. */
export const weekStart = (day: string) => {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return addDays(day, dow === 0 ? -6 : 1 - dow);
};

/**
 * Ofensiva = dias seguidos com pelo menos uma missão, contando até hoje.
 * Se hoje ainda não teve, a de ontem continua valendo (só quebra amanhã).
 */
export function streakFromDays(days: Set<string>, now: Date) {
  const today = brDay(now);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}

type MissionDef = { id: string; title: string; href: string; kinds: string[] };
const FIXED: MissionDef[] = [
  { id: 'licao', title: 'Fazer 1 lição', href: '/aprender', kinds: ['licao'] },
  { id: 'gastos', title: 'Anotar ou categorizar 1 gasto', href: '/carteira?filtro=pendentes', kinds: ['categorizar', 'anotar'] },
];
/** A terceira missão muda todo dia. */
export const DAILY: MissionDef[] = [
  { id: 'previsao', title: 'Ver quanto sobra até o fim do mês', href: '/previsao', kinds: ['visita:previsao'] },
  { id: 'assinaturas', title: 'Dar uma olhada nas assinaturas', href: '/assinaturas', kinds: ['visita:assinaturas', 'assinaturas'] },
  { id: 'tribunal', title: 'Votar no caso do Tribunal', href: '/tribunal', kinds: ['tribunal'] },
  { id: 'limites', title: 'Conferir os limites do mês', href: '/limites', kinds: ['visita:limites', 'limites'] },
  { id: 'chat', title: 'Perguntar uma coisa pro Tostão', href: '/chat', kinds: ['chat'] },
  { id: 'meta', title: 'Guardar qualquer valor na meta', href: '/meta', kinds: ['meta'] },
  { id: 'fechamento', title: 'Abrir o fechamento do mês', href: '/fechamento', kinds: ['visita:fechamento'] },
];
export const missionsFor = (day: string): MissionDef[] => {
  const n = Math.floor(Date.parse(`${day}T12:00:00Z`) / DAY);
  return [...FIXED, DAILY[n % DAILY.length]!];
};
const doneCount = (day: string, kinds: Set<string>) => missionsFor(day).filter((m) => m.kinds.some((k) => kinds.has(k))).length;

function byDay(rows: { day: string; kind: string }[]) {
  const map = new Map<string, Set<string>>();
  for (const r of rows) map.set(r.day, (map.get(r.day) ?? new Set()).add(r.kind));
  return map;
}

/** XP das missões: 5 por missão feita (lição e Tribunal já dão XP próprio). */
export const missionXp = (rows: { kind: string }[]) => rows.filter((r) => r.kind !== 'licao' && r.kind !== 'tribunal').length * 5;

export class EngagementUseCase {
  constructor(private readonly repos: Repositories, private readonly now: () => Date = () => new Date()) {}

  track(userId: string, kind: string) {
    return this.repos.engagement.markActivity(userId, brDay(this.now()), kind);
  }

  /** Ofensiva + placar da semana de uma pessoa (o que amigo pode ver: nada de dinheiro). */
  async score(userId: string) {
    const now = this.now();
    const today = brDay(now);
    const rows = await this.repos.engagement.listActivity(userId, addDays(today, -400));
    const days = byDay(rows);
    const monday = weekStart(today);
    let weekScore = 0;
    for (let d = monday; d <= today; d = addDays(d, 1)) weekScore += doneCount(d, days.get(d) ?? new Set());
    return { streakDays: streakFromDays(new Set(days.keys()), now), weekScore, days, today, monday };
  }

  async missions(userId: string): Promise<MissionsResponse> {
    const { streakDays, days, today, monday } = await this.score(userId);
    const kinds = days.get(today) ?? new Set<string>();
    const missions: MissionDTO[] = missionsFor(today).map((m) => ({ id: m.id, title: m.title, href: m.href, done: m.kinds.some((k) => kinds.has(k)) }));
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
    const [code, ids] = await Promise.all([this.friendCode(userId), this.repos.engagement.listFriendIds(userId)]);
    const people = await Promise.all([userId, ...ids].map(async (id): Promise<FriendDTO | null> => {
      const u = await this.repos.users.findById(id);
      if (!u) return null;
      const s = await this.score(id);
      return { id, name: u.name.trim().split(/\s+/)[0] ?? u.name, streakDays: s.streakDays, weekScore: s.weekScore, me: id === userId };
    }));
    const ranking = people.filter((p): p is FriendDTO => p !== null).sort((a, b) => b.weekScore - a.weekScore || b.streakDays - a.streakDays);
    const sunday = addDays(weekStart(brDay(this.now())), 6);
    return { code, challenge: { title: 'Quem cumpre mais missões na semana', endsAt: `${sunday}T23:59:59-03:00` }, ranking };
  }

  async addFriend(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase().replace(/\s+/g, '');
    const friendId = await this.repos.engagement.findUserByFriendCode(code);
    if (!friendId) throw new AppError('Não achei ninguém com esse código. Confere com seu amigo?', 404);
    if (friendId === userId) throw new AppError('Esse é o seu próprio código.', 400);
    await this.repos.engagement.addFriend(userId, friendId);
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
    const today = brDay(now);
    const [accounts, plan, subs] = await Promise.all([
      this.repos.accounts.listByUser(userId),
      this.repos.plans.get(userId),
      new ListSubscriptionsUseCase(this.repos, () => now).execute({ userId }),
    ]);
    const diff = (iso: string) => Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
    const out: ReminderDTO[] = [];
    for (const a of accounts) {
      if (a.type !== 'CREDIT' || a.hidden || !a.dueDate) continue;
      const due = brDay(new Date(a.dueDate.getTime() + BR));
      const owed = Math.max(0, -a.balanceInCents);
      if (owed > 0) out.push({ key: `fatura:${a.id}:${due}`, kind: 'fatura', title: `Fatura ${a.name}`, amountInCents: owed, dueDate: due, daysLeft: diff(due) });
    }
    for (const f of plan?.fixedExpenses ?? []) {
      const [y, m] = today.split('-').map(Number) as [number, number];
      for (const k of [0, 1]) {
        const last = new Date(Date.UTC(y, m - 1 + k + 1, 0)).getUTCDate();
        const d = new Date(Date.UTC(y, m - 1 + k, Math.min(f.day, last), 12)).toISOString().slice(0, 10);
        if (d >= today) { out.push({ key: `conta:${f.name}:${d}`, kind: 'conta', title: f.name, amountInCents: f.amountInCents, dueDate: d, daysLeft: diff(d) }); break; }
      }
    }
    for (const s of subs.subscriptions) {
      if (!s.active) continue;
      const d = brDay(new Date(s.nextChargeAt));
      out.push({ key: `assinatura:${s.key}:${d}`, kind: 'assinatura', title: s.name, amountInCents: s.amountInCents, dueDate: d, daysLeft: diff(d) });
    }
    return { reminders: out.filter((r) => r.daysLeft >= 0 && r.daysLeft <= days).sort((a, b) => a.daysLeft - b.daysLeft || (b.amountInCents ?? 0) - (a.amountInCents ?? 0)) };
  }

  // ---------- resumo da semana ----------
  /** Últimos 7 dias contra os 7 anteriores (gasto de verdade: sem transferência entre contas e sem conta oculta). */
  async weekly(userId: string): Promise<WeeklyResponse> {
    const now = this.now();
    const today = brDay(now);
    const from = addDays(today, -6);
    const prevFrom = addDays(today, -13);
    const start = new Date(Date.parse(`${prevFrom}T03:00:00Z`));
    const [txs, accounts, categories, score] = await Promise.all([
      this.repos.transactions.findManyInRange(userId, start, new Date(now.getTime() + DAY)),
      this.repos.accounts.listByUser(userId),
      this.repos.categories.list(userId),
      this.score(userId),
    ]);
    const hidden = new Set(accounts.filter((a) => a.hidden).map((a) => a.id));
    const cats = new Map(categories.map((c) => [c.id, c.name]));
    let spent = 0, prev = 0;
    const byCat = new Map<string | null, number>();
    for (const t of txs) {
      if (t.amountInCents >= 0 || t.isInternalTransfer || (t.accountId && hidden.has(t.accountId))) continue;
      const d = brDay(t.occurredAt);
      if (d >= from && d <= today) {
        spent -= t.amountInCents;
        byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) - t.amountInCents);
      } else if (d >= prevFrom && d < from) prev -= t.amountInCents;
    }
    const topEntry = [...byCat].sort((a, b) => b[1] - a[1])[0];
    let missionsDone = 0;
    for (let d = from; d <= today; d = addDays(d, 1)) missionsDone += doneCount(d, score.days.get(d) ?? new Set());
    return {
      from, to: today, spentInCents: spent, prevSpentInCents: prev,
      top: topEntry ? { categoryId: topEntry[0], name: topEntry[0] ? cats.get(topEntry[0]) ?? 'Outros' : 'Sem categoria', totalInCents: topEntry[1] } : null,
      missionsDone, streakDays: score.streakDays,
    };
  }
}
