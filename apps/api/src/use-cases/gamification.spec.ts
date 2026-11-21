// T1.6 · gamificação: Tigrinho, Tribunal por semana, ofensiva unificada, XP só de missão do dia, pedidos de amizade.
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { civilDay } from '../lib/tz.js';
import { isBetTransaction } from '../services/bets.js';
import { EngagementUseCase, missionsFor, missionXp } from './engagement.js';
import { GamesUseCase, tigrinhoState } from './games.js';
import { ListLessonProgressUseCase } from './lesson-progress.js';

let repos: ReturnType<typeof makeInMemoryRepositories>;
let now: Date;
let games: GamesUseCase;
const brt = (iso: string) => new Date(`${iso}-03:00`);
const spend = (description: string, at: Date, categoryId: string | null = null, cents = -50_00) =>
  repos.transactions.create({
    userId: 'u1',
    accountId: null,
    externalId: null,
    description,
    amountInCents: cents,
    occurredAt: at,
    categoryId,
    isInternalTransfer: false,
    seriesId: null,
  });

beforeEach(() => {
  repos = makeInMemoryRepositories();
  now = brt('2026-11-10T15:00:00');
  games = new GamesUseCase(repos, () => now);
});

describe('Tigrinho', () => {
  it('batalha VENCIDA nunca é sobrescrita por um novo "começar"', async () => {
    await games.startTigrinho('u1');
    now = brt('2026-12-12T10:00:00');
    expect((await games.battles('u1')).tigrinho?.status).toBe('vencida');
    const startedAt = (await repos.games.findBattle('u1', 'tigrinho'))!.startedAt;
    await games.startTigrinho('u1'); // o botão ainda estava na tela e a pessoa clicou
    const b = await repos.games.findBattle('u1', 'tigrinho');
    expect(b).toMatchObject({ status: 'vencida' });
    expect(b!.startedAt).toEqual(startedAt);
  });

  it('só quem PERDEU recomeça', async () => {
    await games.startTigrinho('u1');
    await spend('BLAZE', brt('2026-11-11T09:00:00'), 'apostas');
    now = brt('2026-11-12T10:00:00');
    expect((await games.battles('u1')).tigrinho?.status).toBe('perdida');
    await games.startTigrinho('u1');
    expect((await games.battles('u1')).tigrinho).toMatchObject({ status: 'ativa', day: 1 });
  });

  it('o Dia 1 é o dia civil inteiro: aposta de MANHÃ, antes de abrir a batalha à tarde, já conta', async () => {
    await spend('PIXBET', brt('2026-11-10T08:00:00'), 'apostas'); // 08h; a batalha abre às 15h
    await games.startTigrinho('u1'); // now = 10/11 15h
    now = brt('2026-11-10T20:00:00');
    expect((await games.battles('u1')).tigrinho?.status).toBe('perdida');
  });

  it('aposta do dia ANTERIOR ao início não conta', async () => {
    await spend('PIXBET', brt('2026-11-09T23:30:00'), 'apostas');
    await games.startTigrinho('u1');
    now = brt('2026-11-10T20:00:00');
    expect((await games.battles('u1')).tigrinho?.status).toBe('ativa');
  });

  it('o contador PARA no dia da aposta (não segue subindo enquanto a pessoa abre o app)', async () => {
    await games.startTigrinho('u1');
    await spend('BLAZE', brt('2026-11-13T12:00:00'), 'apostas'); // dia 4
    now = brt('2026-11-25T10:00:00');
    expect((await games.battles('u1')).tigrinho).toMatchObject({ status: 'perdida', day: 4 });
    now = brt('2026-12-20T10:00:00');
    expect((await games.battles('u1')).tigrinho).toMatchObject({ status: 'perdida', day: 4 });
  });

  it('aposta é uma definição só: categoria "apostas" OU nome da casa (a mesma regra do aviso do Tostão Auto)', async () => {
    const t = (o: object) => ({
      categoryId: null,
      amountInCents: -10_00,
      isInternalTransfer: false,
      description: 'X',
      ...o,
    });
    expect(isBetTransaction(t({ categoryId: 'apostas' }))).toBe(true);
    expect(isBetTransaction(t({ description: 'PIX BETANO LTDA' }))).toBe(true);
    expect(isBetTransaction(t({ description: 'Fortune Tiger' }))).toBe(true);
    expect(isBetTransaction(t({ description: 'MERCADO', categoryId: 'mercado' }))).toBe(false);
    expect(isBetTransaction(t({ description: 'BETANO', amountInCents: 10_00 }))).toBe(false); // entrada
    expect(isBetTransaction(t({ description: 'BETANO', isInternalTransfer: true }))).toBe(false);
    // e a batalha usa essa regra: aposta SEM categoria mas com o nome da casa perde
    const b = {
      userId: 'u1',
      kind: 'tigrinho' as const,
      status: 'ativa' as const,
      startedAt: brt('2026-11-10T09:00:00'),
      endedAt: null,
      steps: [],
    };
    const tx = await spend('PIX BETANO', brt('2026-11-11T10:00:00'), null);
    expect(tigrinhoState(b, [tx], brt('2026-11-12T10:00:00')).status).toBe('perdida');
  });
});

describe('Tribunal: um voto por pessoa, por caso, por semana', () => {
  it('votar de novo na mesma semana é 409 e o voto original fica', async () => {
    const c = (await games.tribunal('u1')).case;
    await games.vote('u1', c.id, 1);
    await expect(games.vote('u1', c.id, 0)).rejects.toMatchObject({ statusCode: 409 });
    expect((await games.tribunal('u1')).myVote).toBe(1);
  });

  it('o mesmo caso numa OUTRA semana vale de novo (weekKey diferente)', async () => {
    const c = (await games.tribunal('u1')).case;
    await games.vote('u1', c.id, 1);
    expect(await repos.games.vote('u1', c.id, '2026-11-02', 0)).toBe(true); // semana anterior, outro weekKey
    expect(await repos.games.vote('u1', c.id, '2026-11-02', 1)).toBe(false);
    expect(await repos.games.countVotes(c.id, '2026-11-02')).toEqual([1]);
  });

  it('dois votos simultâneos da mesma pessoa: só um grava', async () => {
    const c = (await games.tribunal('u1')).case;
    const r = await Promise.allSettled([games.vote('u1', c.id, 0), games.vote('u1', c.id, 1)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await repos.games.countUserVotes('u1')).toBe(1);
  });
});

describe('ofensiva e XP', () => {
  it('a ofensiva é a MESMA na tela de missões e na de Aprender, mesmo com lição sem linha de atividade', async () => {
    const eng = new EngagementUseCase(repos, () => now);
    // lição de ontem (sem marcar atividade: caso de conta antiga) + missão hoje
    repos.lessons.items.push({ userId: 'u1', lessonId: 'm1-l1', completedAt: brt('2026-11-09T10:00:00') });
    await eng.track('u1', 'anotar');
    const [missions, progress] = [
      await eng.missions('u1'),
      await new ListLessonProgressUseCase(repos, () => now).execute({ userId: 'u1' }),
    ];
    expect(missions.streakDays).toBe(2);
    expect(progress.streakDays).toBe(2);
  });

  it('XP só conta MISSÃO DO DIA: tipo que não é da missão de hoje não rende (antes cada linha valia 5 XP)', () => {
    const day = '2026-11-10';
    const daily = missionsFor(day)[2]!; // a missão que muda todo dia
    const rows = [
      { day, kind: 'anotar' }, // missão fixa "gastos": vale
      { day, kind: daily.kinds[0]! }, // a missão do dia: vale
      { day, kind: 'licao' }, // já dá XP próprio
      { day, kind: 'tribunal' }, // idem
      ...['chat', 'meta', 'limites', 'assinaturas', 'visita:fechamento']
        .filter((k) => !daily.kinds.includes(k))
        .map((kind) => ({ day, kind })), // missões de OUTROS dias: não valem hoje
    ];
    const expected = daily.id === 'tribunal' ? 5 : 10;
    expect(missionXp(rows)).toBe(expected);
    // categorizar e anotar são a MESMA missão: fazer as duas não paga em dobro
    expect(
      missionXp([
        { day, kind: 'anotar' },
        { day, kind: 'categorizar' },
      ]),
    ).toBe(5);
  });

  it('POST /activity só aceita visitas a telas: tipos de missão que o servidor deriva ("meta", "licao"...) são 400', async () => {
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
      webOrigin: '*',
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Ana', email: 'a@x.com', password: '12345678', acceptedTerms: true },
    });
    const auth = { authorization: `Bearer ${reg.json().accessToken}` };
    for (const kind of ['licao', 'meta', 'chat', 'categorizar', 'anotar', 'tribunal', 'qualquer-coisa'])
      expect(
        (await app.inject({ method: 'POST', url: '/activity', headers: auth, payload: { kind } })).statusCode,
        kind,
      ).toBe(400);
    expect(
      (await app.inject({ method: 'POST', url: '/activity', headers: auth, payload: { kind: 'visita:previsao' } }))
        .statusCode,
    ).toBe(204);
  });
});

describe('amizade com pedido e aceite', () => {
  async function pair() {
    const a = await repos.users.create({ name: 'Ana Souza', email: 'a@x.com', passwordHash: 'x' });
    const b = await repos.users.create({ name: 'Bia Lima', email: 'b@x.com', passwordHash: 'x' });
    const eng = new EngagementUseCase(repos, () => now);
    return { a, b, eng, codeOfB: (await eng.friends(b.id)).code, codeOfA: (await eng.friends(a.id)).code };
  }

  it('usar o código manda um pedido: ninguém vê ofensiva de ninguém até aceitar', async () => {
    const { a, b, eng, codeOfB } = await pair();
    const r = await eng.addFriend(a.id, codeOfB);
    expect(r.ranking.map((p) => p.name)).toEqual(['Ana']);
    expect(r.requests.outgoing).toHaveLength(1);
    expect((await eng.friends(b.id)).ranking.map((p) => p.name)).toEqual(['Bia']);
    expect(await repos.engagement.listFriendIds(a.id)).toEqual([]);
  });

  it('pedido repetido é 409; recusar some; dá pra pedir de novo depois de recusado', async () => {
    const { a, b, eng, codeOfB } = await pair();
    await eng.addFriend(a.id, codeOfB);
    await expect(eng.addFriend(a.id, codeOfB)).rejects.toMatchObject({ statusCode: 409 });
    const incoming = (await eng.friends(b.id)).requests.incoming[0]!;
    const declined = await eng.respondRequest(b.id, incoming.id, false);
    expect(declined.requests.incoming).toEqual([]);
    expect(await repos.engagement.listFriendIds(b.id)).toEqual([]);
    await eng.addFriend(a.id, codeOfB); // reabre
    expect((await eng.friends(b.id)).requests.incoming).toHaveLength(1);
  });

  it('só quem RECEBEU responde: outra pessoa, o próprio autor ou pedido inexistente = 404', async () => {
    const { a, b, eng, codeOfB } = await pair();
    const c = await repos.users.create({ name: 'Caio', email: 'c@x.com', passwordHash: 'x' });
    await eng.addFriend(a.id, codeOfB);
    const id = (await eng.friends(b.id)).requests.incoming[0]!.id;
    for (const who of [a.id, c.id])
      await expect(eng.respondRequest(who, id, true)).rejects.toMatchObject({ statusCode: 404 });
    await expect(eng.respondRequest(b.id, 'nao-existe', true)).rejects.toMatchObject({ statusCode: 404 });
    await eng.respondRequest(b.id, id, true);
    await expect(eng.respondRequest(b.id, id, true)).rejects.toMatchObject({ statusCode: 404 }); // já respondido
  });

  it('se a outra pessoa já tinha pedido, usar o código dela aceita na hora (sem pedido cruzado)', async () => {
    const { a, b, eng, codeOfA, codeOfB } = await pair();
    await eng.addFriend(a.id, codeOfB);
    const r = await eng.addFriend(b.id, codeOfA);
    expect(r.ranking.map((p) => p.name).sort()).toEqual(['Ana', 'Bia']);
    expect((await eng.friends(a.id)).requests).toEqual({ incoming: [], outgoing: [] });
  });

  it('aceitar duas vezes ao mesmo tempo: só uma ganha e a amizade existe uma vez só', async () => {
    const { a, b, eng, codeOfB } = await pair();
    await eng.addFriend(a.id, codeOfB);
    const id = (await eng.friends(b.id)).requests.incoming[0]!.id;
    const r = await Promise.allSettled([eng.respondRequest(b.id, id, true), eng.respondRequest(b.id, id, true)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await repos.engagement.listFriendIds(a.id)).toEqual([b.id]);
  });

  it('já são amigos: pedir de novo só devolve o placar', async () => {
    const { a, b, eng, codeOfB } = await pair();
    await eng.addFriend(a.id, codeOfB);
    await eng.respondRequest(b.id, (await eng.friends(b.id)).requests.incoming[0]!.id, true);
    const r = await eng.addFriend(a.id, codeOfB);
    expect(r.requests.outgoing).toEqual([]);
    expect(r.ranking).toHaveLength(2);
  });
});

describe('o dia civil vem do fuso da pessoa', () => {
  it('a missão de 22h em Brasília conta no dia de Brasília (e não no dia UTC seguinte)', async () => {
    const eng = new EngagementUseCase(repos, () => brt('2026-11-10T22:30:00'));
    await eng.track('u1', 'anotar');
    expect(repos.engagement.activity[0]!.day).toBe(civilDay(brt('2026-11-10T22:30:00')));
    expect(repos.engagement.activity[0]!.day).toBe('2026-11-10');
  });
});
