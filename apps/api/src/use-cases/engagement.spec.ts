import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { EngagementUseCase, missionsFor, streakFromDays, weekStart } from './engagement.js';
import { RegisterUserUseCase } from './register-user.js';
import { runNotifications } from '../jobs/notifications.js';
import { FakePushGateway } from '../gateways/push-gateway.js';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';

let repos: ReturnType<typeof makeInMemoryRepositories>;
let now: Date;
let eng: EngagementUseCase;
const user = (name: string) => repos.users.create({ name, email: `${name}@x.com`, passwordHash: 'x' });

beforeEach(() => {
  repos = makeInMemoryRepositories();
  now = new Date('2026-11-12T15:00:00Z'); // quinta, meio-dia em Brasília
  eng = new EngagementUseCase(repos, () => now);
});

describe('ofensiva e missões', () => {
  it('conta dias seguidos; hoje sem missão ainda não quebra', () => {
    const days = new Set(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(streakFromDays(days, now)).toBe(3);
    expect(streakFromDays(new Set([...days, '2026-11-12']), now)).toBe(4);
    expect(streakFromDays(new Set(['2026-11-09', '2026-11-10']), now)).toBe(0);
  });

  it('semana começa na segunda', () => {
    expect(weekStart('2026-11-12')).toBe('2026-11-09');
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // domingo
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
  });

  it('três missões por dia; a terceira muda todo dia', async () => {
    expect(missionsFor('2026-11-12')).toHaveLength(3);
    expect(missionsFor('2026-11-12')[2]!.id).not.toBe(missionsFor('2026-11-13')[2]!.id);
    const u = await user('Ana');
    await eng.track(u.id, 'anotar');
    const m = await eng.missions(u.id);
    expect(m.missions.map((x) => x.done)).toEqual([false, true, false]);
    expect(m.streakDays).toBe(1);
    expect(m.todayKept).toBe(true);
    expect(m.week.find((d) => d.day === '2026-11-12')?.done).toBe(1);
  });
});

describe('amigos', () => {
  it('adiciona pelo código, ranking da semana sem dinheiro', async () => {
    const [a, b] = [await user('Ana Souza'), await user('Bia')];
    const { code } = await eng.friends(b.id);
    await eng.track(b.id, 'licao');
    await eng.track(b.id, 'anotar');
    // Usar o código MANDA UM PEDIDO: ninguém entra no ranking até a outra pessoa aceitar.
    const pending = await eng.addFriend(a.id, code.toLowerCase());
    expect(pending.ranking).toHaveLength(1);
    expect(pending.requests.outgoing.map((r) => r.name)).toEqual(['Bia']);
    const incoming = (await eng.friends(b.id)).requests.incoming;
    expect(incoming.map((r) => r.name)).toEqual(['Ana']);
    const r = await eng.respondRequest(b.id, incoming[0]!.id, true);
    expect(r.ranking.map((p) => [p.name, p.weekScore, p.me])).toEqual([
      ['Bia', 2, true],
      ['Ana', 0, false],
    ]);
    const forA = await eng.friends(a.id);
    expect(forA.ranking.map((p) => [p.name, p.weekScore, p.me])).toEqual([
      ['Bia', 2, false],
      ['Ana', 0, true],
    ]);
    expect(forA.requests).toEqual({ incoming: [], outgoing: [] });
    await expect(eng.addFriend(a.id, (await eng.friends(a.id)).code)).rejects.toThrow('próprio');
    await expect(eng.addFriend(a.id, 'TOST-NADA0')).rejects.toThrow('Não achei');
    expect((await eng.removeFriend(a.id, b.id)).ranking).toHaveLength(1);
  });

  it('quem entra com convite ou link de amigo já vira amigo', async () => {
    const a = await user('Ana');
    const invite = await repos.invites.create({ code: 'TOST-AAAA-BBBB', createdById: a.id });
    const register = new RegisterUserUseCase(repos);
    const { user: c } = await register.execute({
      name: 'Caio',
      email: 'c@x.com',
      password: '12345678',
      inviteCode: invite.code,
    });
    const { code } = await eng.friends(a.id);
    const { user: d } = await register.execute({
      name: 'Duda',
      email: 'd@x.com',
      password: '12345678',
      inviteCode: code,
    });
    expect((await repos.engagement.listFriendIds(a.id)).sort()).toEqual([c.id, d.id].sort());
  });
});

describe('avisos e resumo', () => {
  it('fatura, conta fixa e assinatura que vencem logo', async () => {
    const u = await user('Ana');
    const conn = await repos.connections.create({ userId: u.id, itemId: 'i', institution: 'Banco' });
    await repos.accounts.upsertByExternalId({
      userId: u.id,
      connectionId: conn.id,
      externalId: 'c1',
      name: 'Nubank',
      type: 'CREDIT',
      balanceInCents: -31200,
      fingerprint: null,
      creditLimitInCents: null,
      dueDate: new Date('2026-11-14T00:00:00Z'),
    });
    await repos.plans.save(u.id, {
      salary: null,
      otherIncomes: [],
      benefits: [],
      goal: null,
      fixedExpenses: [
        { name: 'Aluguel', amountInCents: 90000, day: 15 },
        { name: 'Luz', amountInCents: 9000, day: 5 },
      ],
    });
    const { reminders } = await eng.reminders(u.id);
    expect(reminders.map((r) => [r.kind, r.title, r.daysLeft])).toEqual([
      ['fatura', 'Fatura Nubank', 2],
      ['conta', 'Aluguel', 3],
    ]);
  });

  it('resumo da semana compara com a anterior e ignora transferência', async () => {
    const u = await user('Ana');
    const tx = (date: string, cents: number, categoryId: string | null, internal = false) =>
      repos.transactions.create({
        userId: u.id,
        accountId: null,
        externalId: null,
        description: 'x',
        amountInCents: cents,
        occurredAt: new Date(`${date}T15:00:00Z`),
        categoryId,
        isInternalTransfer: internal,
      });
    await tx('2026-11-10', -5000, 'delivery');
    await tx('2026-11-11', -2000, 'mercado');
    await tx('2026-11-11', -90000, null, true);
    await tx('2026-11-02', -10000, 'delivery');
    const w = await eng.weekly(u.id);
    expect(w).toMatchObject({ from: '2026-11-06', to: '2026-11-12', spentInCents: 7000, prevSpentInCents: 10000 });
    expect(w.top).toMatchObject({ categoryId: 'delivery', totalInCents: 5000 });
  });

  it('manda cada aviso uma vez e limpa inscrição morta', async () => {
    const u = await user('Ana');
    await repos.engagement.savePush({ endpoint: 'https://push/1', userId: u.id, p256dh: 'p', auth: 'a' });
    const push = new FakePushGateway();
    await repos.engagement.markActivity(u.id, '2026-11-11', 'licao'); // ofensiva de ontem, hoje nada
    const night = new Date('2026-11-12T23:30:00Z'); // 20h30 em Brasília
    await runNotifications(repos, push, night);
    await runNotifications(repos, push, night);
    expect(push.sent.filter((s) => s.payload.tag === 'ofensiva')).toHaveLength(1);
    expect(push.sent[0]!.payload.title).toContain('ofensiva');
  });
});

describe('rotas', () => {
  it('ação que dá certo conta como missão', async () => {
    const app = await buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'm@x.com', password: '12345678', acceptedTerms: true },
    });
    const auth = { authorization: `Bearer ${reg.json().accessToken}` };
    await app.inject({ method: 'POST', url: '/progress/m1-l1', headers: auth });
    expect(
      (await app.inject({ method: 'POST', url: '/activity', headers: auth, payload: { kind: 'visita:previsao' } }))
        .statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ method: 'POST', url: '/activity', headers: auth, payload: { kind: 'hackear' } })).statusCode,
    ).toBe(400);
    const m = (await app.inject({ method: 'GET', url: '/missions', headers: auth })).json();
    expect(m.missions[0].done).toBe(true);
    expect(m.streakDays).toBe(1);
    expect((await app.inject({ method: 'GET', url: '/push/key', headers: auth })).json()).toEqual({
      publicKey: null,
      subscribed: 0,
    });
  });
});

describe('POST /push/subscriptions (SSRF e sequestro de inscrição)', () => {
  const keys = { p256dh: 'A'.repeat(87), auth: 'a'.repeat(22) };
  const endpoint = 'https://fcm.googleapis.com/fcm/send/aparelho-da-ana';

  async function setup() {
    const repos = makeInMemoryRepositories();
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    const login = async (email: string) => {
      const reg = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'Fulano', email, password: '12345678', acceptedTerms: true },
      });
      return {
        auth: { authorization: `Bearer ${reg.json().accessToken}` },
        id: reg.json().user?.id as string | undefined,
      };
    };
    const subscribe = (auth: { authorization: string }, body: unknown) =>
      app.inject({ method: 'POST', url: '/push/subscriptions', headers: auth, payload: body as object });
    return { repos, app, login, subscribe };
  }

  it('bloqueia endpoint interno ou fora da allowlist e aceita os serviços oficiais', async () => {
    const { login, subscribe, repos } = await setup();
    const { auth } = await login('a@x.com');
    for (const bad of [
      'http://127.0.0.1:3334/push',
      'http://169.254.169.254/latest/meta-data',
      'https://evil.com/push',
      'https://127.0.0.1/push',
      'https://fcm.googleapis.com:8443/x',
    ]) {
      expect((await subscribe(auth, { endpoint: bad, keys })).statusCode, bad).toBe(400);
    }
    for (const good of [
      'https://fcm.googleapis.com/fcm/send/1',
      'https://updates.push.services.mozilla.com/wpush/v2/1',
      'https://web.push.apple.com/1',
      'https://wns2-par02p.notify.windows.com/w/?token=1',
    ]) {
      expect((await subscribe(auth, { endpoint: good, keys })).statusCode, good).toBe(204);
    }
    expect(repos.engagement.push).toHaveLength(4);
  });

  it('usuário B não sobrescreve o endpoint registrado pelo usuário A', async () => {
    const { login, subscribe, repos } = await setup();
    const a = await login('ana@x.com');
    const b = await login('bia@x.com');
    expect((await subscribe(a.auth, { endpoint, keys })).statusCode).toBe(204);
    const donoOriginal = repos.engagement.push[0]!.userId;

    const roubo = await subscribe(b.auth, { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'b'.repeat(22) } });
    expect(roubo.statusCode).toBe(403);
    // nada mudou: mesmo dono, mesmas chaves
    expect(repos.engagement.push).toHaveLength(1);
    expect(repos.engagement.push[0]).toMatchObject({ userId: donoOriginal, p256dh: keys.p256dh, auth: keys.auth });
  });

  it('o dono pode reenviar a própria inscrição (renovar as chaves)', async () => {
    const { login, subscribe, repos } = await setup();
    const a = await login('ana@x.com');
    await subscribe(a.auth, { endpoint, keys });
    const novas = { p256dh: 'C'.repeat(87), auth: 'c'.repeat(22) };
    expect((await subscribe(a.auth, { endpoint, keys: novas })).statusCode).toBe(204);
    expect(repos.engagement.push).toHaveLength(1);
    expect(repos.engagement.push[0]).toMatchObject(novas);
  });
});
