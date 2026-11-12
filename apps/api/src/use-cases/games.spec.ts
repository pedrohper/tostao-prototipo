import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { GamesUseCase } from './games.js';
import { caseOfWeek } from '../lib/tribunal-cases.js';
import { ListLessonProgressUseCase } from './lesson-progress.js';

let repos: ReturnType<typeof makeInMemoryRepositories>;
let now: Date;
let games: GamesUseCase;
const bet = (date: string, cents = -5000) =>
  repos.transactions.create({ userId: 'u1', accountId: null, externalId: null, description: 'BLAZE', amountInCents: cents, occurredAt: new Date(`${date}T15:00:00Z`), categoryId: 'apostas', isInternalTransfer: false });

beforeEach(() => {
  repos = makeInMemoryRepositories();
  now = new Date('2026-11-12T15:00:00Z');
  games = new GamesUseCase(repos, () => now);
});

describe('Tribunal do Tostão', () => {
  it('um caso por semana, encerra domingo à noite', () => {
    const a = caseOfWeek(new Date('2026-11-09T12:00:00Z'));
    const b = caseOfWeek(new Date('2026-11-15T23:00:00Z'));
    const c = caseOfWeek(new Date('2026-11-16T12:00:00Z'));
    expect(a.case.id).toBe(b.case.id);
    expect(c.case.id).not.toBe(a.case.id);
    expect(a.endsAt.toISOString()).toBe('2026-11-16T02:59:59.999Z'); // domingo 23:59:59 em Brasília
  });

  it('placar e veredito só aparecem depois do voto; votar de novo troca o voto', async () => {
    const before = await games.tribunal('u1');
    expect(before.votes).toBeNull();
    expect(before.verdict).toBeNull();
    await games.vote('u2', before.case.id, 1);
    const after = await games.vote('u1', before.case.id, 0);
    expect(after.votes).toEqual([1, 1]);
    expect(after.verdict?.title).toBeTruthy();
    const changed = await games.vote('u1', before.case.id, 1);
    expect(changed.votes).toEqual([0, 2]);
    expect(changed.myVote).toBe(1);
  });

  it('não aceita voto em caso velho nem opção que não existe', async () => {
    const { case: c } = await games.tribunal('u1');
    await expect(games.vote('u1', 'caso-velho', 0)).rejects.toThrow('encerrou');
    await expect(games.vote('u1', c.id, 5)).rejects.toThrow('inválida');
  });
});

describe('Batalha contra o Tigrinho', () => {
  it('conta os dias e vence com 30 dias sem aposta', async () => {
    await games.startTigrinho('u1');
    now = new Date('2026-11-29T15:00:00Z');
    expect((await games.battles('u1')).tigrinho).toMatchObject({ status: 'ativa', day: 18 });
    now = new Date('2026-12-12T15:00:00Z');
    expect((await games.battles('u1')).tigrinho).toMatchObject({ status: 'vencida', day: 30 });
    expect((await games.battles('u1')).urubu.status).toBe('ativa');
  });

  it('aposta depois do início perde a batalha; aposta antes não conta', async () => {
    await bet('2026-11-10');
    await games.startTigrinho('u1');
    expect((await games.battles('u1')).tigrinho?.status).toBe('ativa');
    await bet('2026-11-20');
    now = new Date('2026-11-21T15:00:00Z');
    const r = await games.battles('u1');
    expect(r.tigrinho).toMatchObject({ status: 'perdida' });
    // recomeçar zera o contador
    await games.startTigrinho('u1');
    expect((await games.battles('u1')).tigrinho).toMatchObject({ status: 'ativa', day: 1 });
  });

  it('Urubu fica bloqueado até vencer o Tigrinho; com os 3 passos, vence', async () => {
    await expect(games.toggleUrubuStep('u1', 'chaves', true)).rejects.toThrow('Tigrinho');
    await games.startTigrinho('u1');
    now = new Date('2026-12-13T15:00:00Z');
    await games.battles('u1');
    for (const id of ['limite-noturno', 'chaves', 'palavra-senha']) await games.toggleUrubuStep('u1', id, true);
    expect((await games.battles('u1')).urubu.status).toBe('vencida');
    // XP: 2 batalhas vencidas
    const progress = await new ListLessonProgressUseCase(repos, () => now).execute({ userId: 'u1' });
    expect(progress.bonusXp).toBe(200);
  });
});
