import type { LessonProgressResponse } from '@tostao/contracts';
// Cada lição vale 20 XP (é o que o player mostra no fim). A cada 100 XP sobe um nível.
export const XP_PER_LESSON = 20;

/** bonusXp: o que veio dos jogos (voto no Tribunal, batalha vencida), calculado na API. */
export function xpFrom(lessonsDone: number, bonusXp = 0) {
  const xp = lessonsDone * XP_PER_LESSON + bonusXp;
  return { xp, level: Math.floor(xp / 100) + 1 };
}

/** Se /progress falhar, a tela segue com tudo zerado. */
export const NO_PROGRESS: LessonProgressResponse = { done: [], streakDays: 0, doneToday: 0, bonusXp: 0 };
