// Cada lição vale 20 XP (é o que o player mostra no fim). A cada 100 XP sobe um nível.
export const XP_PER_LESSON = 20;

export function xpFrom(lessonsDone: number) {
  const xp = lessonsDone * XP_PER_LESSON;
  return { xp, level: Math.floor(xp / 100) + 1 };
}
