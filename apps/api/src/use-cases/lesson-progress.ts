import type { Repositories } from '../repositories/types.js';
import { addCivilDays, civilDay } from '../lib/tz.js';
import { timezoneOf } from '../lib/user-tz.js';
import { missionXp, streakFromDays } from './engagement.js';

/**
 * Ofensiva só de LIÇÕES (dias seguidos com pelo menos uma lição, até hoje). Mantida pelos testes e pelo simulador;
 * a ofensiva que o app mostra é a unificada (lições + missões), calculada com streakFromDays.
 */
export function streakFrom(completedAt: Date[], now: Date, tz?: string) {
  return streakFromDays(new Set(completedAt.map((d) => civilDay(d, tz))), now, tz);
}

export class ListLessonProgressUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'lessons' | 'games' | 'engagement' | 'users'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId }: { userId: string }) {
    const now = this.now();
    const tz = await timezoneOf(this.repos.users, userId);
    const today = civilDay(now, tz);
    const [rows, votes, battles, activity] = await Promise.all([
      this.repos.lessons.listByUser(userId),
      this.repos.games.countUserVotes(userId),
      this.repos.games.listBattles(userId),
      this.repos.engagement.listActivity(userId, addCivilDays(today, -400)),
    ]);
    return {
      done: rows.map((l) => l.lessonId),
      // Ofensiva: dias com qualquer missão OU lição. É a MESMA conta do EngagementUseCase.score.
      streakDays: streakFromDays(
        new Set([...rows.map((l) => civilDay(l.completedAt, tz)), ...activity.map((a) => a.day)]),
        now,
        tz,
      ),
      doneToday: rows.filter((l) => civilDay(l.completedAt, tz) === today).length,
      // XP dos jogos: 20 por voto no Tribunal, 100 por batalha vencida, 5 por missão do dia feita
      bonusXp: votes * 20 + battles.filter((b) => b.status === 'vencida').length * 100 + missionXp(activity),
    };
  }
}
