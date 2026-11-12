import { describe, expect, it } from 'vitest';
import { streakFrom } from './lesson-progress.js';

const at = (s: string) => new Date(`${s}T15:00:00Z`);
describe('ofensiva', () => {
  const now = at('2026-11-12');
  it('conta dias seguidos até hoje', () => expect(streakFrom([at('2026-11-10'), at('2026-11-11'), at('2026-11-12'), at('2026-11-12')], now)).toBe(3));
  it('sem lição hoje, mantém a de ontem', () => expect(streakFrom([at('2026-11-10'), at('2026-11-11')], now)).toBe(2));
  it('pulou um dia, zera', () => expect(streakFrom([at('2026-11-09'), at('2026-11-10')], now)).toBe(0));
  it('meia-noite em Brasília conta no dia certo', () => expect(streakFrom([new Date('2026-11-12T02:30:00Z')], now)).toBe(1)); // 23:30 do dia 11 em BRT -> ontem
});
