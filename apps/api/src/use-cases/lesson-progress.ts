import type { Repositories } from '../repositories/types.js';
import { missionXp, streakFromDays } from './engagement.js';

const DAY = 24 * 60 * 60 * 1000;
/** Dia em Brasília (UTC−3), como "2026-11-12". */
const brDay = (d: Date) => new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * Ofensiva = dias seguidos com pelo menos uma lição, contando até hoje.
 * Se hoje ainda não teve lição, a ofensiva de ontem continua valendo (só quebra amanhã).
 */
export function streakFrom(completedAt: Date[], now: Date) {
  const days = new Set(completedAt.map(brDay));
  let cursor = days.has(brDay(now)) ? now : new Date(now.getTime() - DAY);
  let streak = 0;
  while (days.has(brDay(cursor))) { streak++; cursor = new Date(cursor.getTime() - DAY); }
  return streak;
}

export class ListLessonProgressUseCase {
  constructor(private readonly repos: Pick<Repositories, 'lessons' | 'games' | 'engagement'>, private readonly now: () => Date = () => new Date()) {}

  async execute({ userId }: { userId: string }) {
    const now = this.now();
    const today = brDay(now);
    const [rows, votes, battles, activity] = await Promise.all([
      this.repos.lessons.listByUser(userId), this.repos.games.countUserVotes(userId), this.repos.games.listBattles(userId),
      this.repos.engagement.listActivity(userId, brDay(new Date(now.getTime() - 400 * DAY))),
    ]);
    return {
      done: rows.map((l) => l.lessonId),
      // Ofensiva: dias com qualquer missão (lição, anotar, categorizar, jogo...)
      streakDays: streakFromDays(new Set([...rows.map((l) => brDay(l.completedAt)), ...activity.map((a) => a.day)]), now),
      doneToday: rows.filter((l) => brDay(l.completedAt) === today).length,
      // XP dos jogos: 20 por voto no Tribunal, 100 por batalha vencida
      bonusXp: votes * 20 + battles.filter((b) => b.status === 'vencida').length * 100 + missionXp(activity),
    };
  }
}
