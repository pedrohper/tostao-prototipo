import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { FakeEmailGateway } from '../gateways/email-gateway.js';
import { InvalidRefreshTokenError } from '../domain/errors.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { hashToken, SessionsUseCase } from './sessions.js';

const DAY = 24 * 3600_000;

async function setup() {
  const repos = makeInMemoryRepositories();
  const user = await repos.users.create({ name: 'Pedro', email: 'p@x.com', passwordHash: 'x' });
  const other = await repos.users.create({ name: 'Ana', email: 'a@x.com', passwordHash: 'x' });
  let now = new Date('2026-11-20T12:00:00Z');
  const sessions = new SessionsUseCase(repos, () => now);
  return {
    repos,
    user,
    other,
    sessions,
    clock: () => now,
    tick: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

describe('refresh token: rotação', () => {
  it('guarda só o hash e devolve token opaco de 256 bits', async () => {
    const { repos, user, sessions, clock } = await setup();
    const { refreshToken } = await sessions.open(user.id, { userAgent: 'Firefox', ipAddress: '1.2.3.4' });
    expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = repos.refreshTokens.items[0]!;
    expect(row.tokenHash).toBe(hashToken(refreshToken));
    expect(JSON.stringify(row)).not.toContain(refreshToken);
    // Contra o relógio do próprio caso de uso: `createdAt` do repositório em memória é o relógio real, que não anda junto.
    expect(row.expiresAt.getTime() - clock().getTime()).toBeGreaterThan(29 * DAY);
    expect(row).toMatchObject({ userAgent: 'Firefox', ipAddress: '1.2.3.4', revokedAt: null });
  });

  it('cada renovação troca o token: o anterior é revogado, aponta pro novo e a família é a mesma', async () => {
    const { repos, user, sessions } = await setup();
    const { refreshToken: r1 } = await sessions.open(user.id);
    const second = await sessions.rotate(r1);
    expect(second.userId).toBe(user.id);
    expect(second.refreshToken).not.toBe(r1);
    const [old, fresh] = repos.refreshTokens.items;
    expect(old!.revokedAt).not.toBeNull();
    expect(old!.replacedById).toBe(fresh!.id);
    expect(fresh!.revokedAt).toBeNull();
    expect(fresh!.familyId).toBe(old!.familyId);

    // e o novo também renova
    const third = await sessions.rotate(second.refreshToken);
    expect(third.refreshToken).not.toBe(second.refreshToken);
  });

  it('reuso de token já trocado revoga a família inteira (inclusive o token legítimo mais novo)', async () => {
    const { repos, user, sessions, tick } = await setup();
    const { refreshToken: r1 } = await sessions.open(user.id);
    const { refreshToken: r2 } = await sessions.rotate(r1); // o dono renovou
    tick(31_000); // passou da janela de tolerância
    // o ladrão apresenta o r1 roubado
    await expect(sessions.rotate(r1)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(repos.refreshTokens.items.every((t) => t.revokedAt !== null)).toBe(true);
    // o dono legítimo perde a sessão também: precisa entrar de novo
    await expect(sessions.rotate(r2)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('reuso numa família não mexe nas sessões de outros aparelhos', async () => {
    const { repos, user, sessions, tick } = await setup();
    const { refreshToken: a1 } = await sessions.open(user.id); // aparelho A
    const { refreshToken: b1 } = await sessions.open(user.id); // aparelho B
    await sessions.rotate(a1);
    tick(31_000);
    await expect(sessions.rotate(a1)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    await expect(sessions.rotate(b1)).resolves.toHaveProperty('refreshToken');
    expect(repos.refreshTokens.items.filter((t) => !t.revokedAt)).toHaveLength(1);
  });

  it('token desconhecido, vencido ou de outra forma inválida → 401 sem efeito colateral', async () => {
    const { repos, user, sessions, tick } = await setup();
    await expect(sessions.rotate('x'.repeat(43))).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    const { refreshToken } = await sessions.open(user.id);
    tick(31 * DAY);
    await expect(sessions.rotate(refreshToken)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    // vencido não é "reuso": não derruba nada além dele mesmo
    expect(repos.refreshTokens.items).toHaveLength(1);
    expect(repos.refreshTokens.items[0]!.revokedAt).toBeNull();
  });

  it('dois refresh simultâneos com o mesmo token (duas abas): os dois recebem token, na mesma família, sem derrubar nada', async () => {
    const { repos, user, sessions } = await setup();
    const { refreshToken } = await sessions.open(user.id);
    const results = await Promise.allSettled([sessions.rotate(refreshToken), sessions.rotate(refreshToken)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(repos.refreshTokens.items.filter((t) => !t.revokedAt)).toHaveLength(2);
    expect(new Set(repos.refreshTokens.items.map((t) => t.familyId)).size).toBe(1);
  });
});

describe('refresh token: janela de tolerância de 30 s no reuso (T6.4)', () => {
  it('reuso em 5 s funciona: novo token na mesma família, família intacta e sem registrar reuso', async () => {
    const { repos, user, sessions, tick } = await setup();
    const { refreshToken: p } = await sessions.open(user.id);
    const first = await sessions.rotate(p); // a resposta se perdeu: a aba nunca viu `first`
    tick(5_000);
    const retry = await sessions.rotate(p);
    expect(retry.userId).toBe(user.id);
    expect(retry.refreshToken).not.toBe(first.refreshToken);

    expect(new Set(repos.refreshTokens.items.map((t) => t.familyId)).size).toBe(1);
    // o pai segue revogado, os dois filhos seguem vivos (a outra aba pode ter ficado com o primeiro)
    expect(repos.refreshTokens.items.filter((t) => !t.revokedAt)).toHaveLength(2);
    const actions = repos.audit.items.map((a) => a.action);
    expect(actions).toEqual(['refresh_grace_used']);
    expect(actions).not.toContain('refresh_reuse_detected');
    // o primeiro dos dois que renovar continua; o outro ramo morre junto
    await expect(sessions.rotate(retry.refreshToken)).resolves.toHaveProperty('userId');
    expect(repos.refreshTokens.items.filter((t) => !t.revokedAt)).toHaveLength(1);
  });

  it('cópia usada dentro da janela é denunciada: quando o outro ramo renova e o primeiro volta, a família cai', async () => {
    const { repos, user, sessions, tick } = await setup();
    const { refreshToken: p } = await sessions.open(user.id);
    const victim = await sessions.rotate(p);
    tick(5_000);
    const thief = await sessions.rotate(p); // quem copiou P ganha um irmão pela janela
    tick(15 * 60_000);
    const thiefNext = await sessions.rotate(thief.refreshToken);
    await expect(sessions.rotate(victim.refreshToken)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(repos.audit.items.map((a) => a.action)).toContain('refresh_reuse_detected');
    // derrubada a família, a cópia também não renova mais
    await expect(sessions.rotate(thiefNext.refreshToken)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(repos.refreshTokens.items.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('o limite é 30 s: em 30 s ainda vale; em 31 s derruba a família e grava refresh_reuse_detected', async () => {
    const at30 = await setup();
    const a = await at30.sessions.open(at30.user.id);
    await at30.sessions.rotate(a.refreshToken);
    at30.tick(30_000);
    await expect(at30.sessions.rotate(a.refreshToken)).resolves.toHaveProperty('userId');

    const at31 = await setup();
    const b = await at31.sessions.open(at31.user.id);
    const child = await at31.sessions.rotate(b.refreshToken);
    at31.tick(31_000);
    await expect(at31.sessions.rotate(b.refreshToken)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(at31.repos.refreshTokens.items.every((t) => t.revokedAt !== null)).toBe(true);
    expect(at31.repos.audit.items.map((x) => x.action)).toEqual(['refresh_reuse_detected']);
    await expect(at31.sessions.rotate(child.refreshToken)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('reuso em 5 s DEPOIS que o filho já foi usado derruba a família (o filho foi entregue e usado: é cópia)', async () => {
    const { repos, user, sessions, tick } = await setup();
    const { refreshToken: p } = await sessions.open(user.id);
    const child = await sessions.rotate(p);
    await sessions.rotate(child.refreshToken); // o filho já foi usado
    tick(5_000);
    await expect(sessions.rotate(p)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(repos.refreshTokens.items.every((t) => t.revokedAt !== null)).toBe(true);
    expect(repos.audit.items.map((a) => a.action)).toEqual(['refresh_reuse_detected']);
  });

  it('logout dentro da janela vale: token antigo não ressuscita a sessão', async () => {
    const { user, sessions, tick } = await setup();
    const { refreshToken: p } = await sessions.open(user.id);
    const child = await sessions.rotate(p);
    await sessions.logout(child.refreshToken);
    tick(2_000);
    await expect(sessions.rotate(p)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('a janela não vale pra token revogado por logout (sem filho): continua 401', async () => {
    const { user, sessions, tick } = await setup();
    const { refreshToken: p } = await sessions.open(user.id);
    await sessions.logout(p);
    tick(2_000);
    await expect(sessions.rotate(p)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('filho vencido não conta como vivo: o reuso derruba', async () => {
    const repos = makeInMemoryRepositories();
    const user = await repos.users.create({ name: 'Pedro', email: 'p@x.com', passwordHash: 'x' });
    let now = new Date('2026-11-20T12:00:00Z');
    const sessions = new SessionsUseCase(repos, () => now, 10); // refresh de 10 s: o filho vence logo
    const { refreshToken: p } = await sessions.open(user.id);
    await sessions.rotate(p);
    now = new Date(now.getTime() + 11_000);
    await expect(sessions.rotate(p)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });
});

describe('logout', () => {
  it('logout revoga a família do token e é idempotente', async () => {
    const { repos, user, sessions } = await setup();
    const { refreshToken: a1 } = await sessions.open(user.id);
    const { refreshToken: b1 } = await sessions.open(user.id);
    const { refreshToken: a2 } = await sessions.rotate(a1);
    await sessions.logout(a2);
    await sessions.logout(a2);
    await sessions.logout('desconhecido'.repeat(4));
    await expect(sessions.rotate(a2)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    await expect(sessions.rotate(b1)).resolves.toHaveProperty('userId'); // o outro aparelho segue
    expect(
      repos.refreshTokens.items
        .filter((t) => t.familyId === repos.refreshTokens.items[0]!.familyId)
        .every((t) => t.revokedAt),
    ).toBe(true);
  });

  it('logout-all revoga todas as sessões da pessoa e só dela', async () => {
    const { repos, user, other, sessions } = await setup();
    const { refreshToken: a } = await sessions.open(user.id);
    const { refreshToken: b } = await sessions.open(user.id);
    const { refreshToken: o } = await sessions.open(other.id);
    await sessions.logoutAll(user.id);
    await expect(sessions.rotate(a)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    await expect(sessions.rotate(b)).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    await expect(sessions.rotate(o)).resolves.toHaveProperty('userId');
    expect(repos.refreshTokens.items.filter((t) => t.userId === other.id && !t.revokedAt)).toHaveLength(1);
  });
});

describe('sessão pela API (HTTP)', () => {
  async function bootApi() {
    const repos = makeInMemoryRepositories();
    const email = new FakeEmailGateway();
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
      webOrigin: 'https://tostao.test',
      email,
    });
    const reg = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'user-agent': 'Vitest/1' },
      payload: { name: 'Pedro', email: 'p@x.com', password: '12345678', acceptedTerms: true },
    });
    return { app, repos, email, reg: reg.json() as { accessToken: string; refreshToken: string } };
  }
  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

  it('cadastro e login devolvem { accessToken, refreshToken }; o access token dura 15 min e leva iss/aud/HS256', async () => {
    const { app, reg } = await bootApi();
    expect(Object.keys(reg).sort()).toEqual(['accessToken', 'refreshToken']);
    const [h, p] = reg.accessToken.split('.');
    const header = JSON.parse(Buffer.from(h!, 'base64url').toString()) as { alg: string };
    const payload = JSON.parse(Buffer.from(p!, 'base64url').toString()) as {
      iss: string;
      aud: string;
      exp: number;
      iat: number;
    };
    expect(header.alg).toBe('HS256');
    expect(payload).toMatchObject({ iss: 'tostao-api', aud: 'tostao-web' });
    expect(payload.exp - payload.iat).toBe(15 * 60);

    const login = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { email: 'p@x.com', password: '12345678' },
    });
    expect(login.statusCode).toBe(200);
    expect(Object.keys(login.json()).sort()).toEqual(['accessToken', 'refreshToken']);
  });

  it('JWT de outro emissor, outro público, sem iss/aud, outro algoritmo ou alg=none não entra', async () => {
    const { app, reg } = await bootApi();
    const secret = 'segredo-de-teste-com-32-caracteres!!';
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forge = (claims: Record<string, unknown>, alg: 'HS256' | 'HS512' = 'HS256') => {
      const data = `${b64({ alg, typ: 'JWT' })}.${b64({ sub: 'x', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600, ...claims })}`;
      const sig = createHmac(alg === 'HS256' ? 'sha256' : 'sha512', secret)
        .update(data)
        .digest('base64url');
      return `${data}.${sig}`;
    };
    const valid = { iss: 'tostao-api', aud: 'tostao-web' };
    const me = (t: string) => app.inject({ method: 'GET', url: '/me', headers: bearer(t) });

    // sanidade: o forjador com claims certos é aceito (404 = passou da assinatura, só não existe usuário "x")
    expect((await me(forge(valid))).statusCode).toBe(404);
    expect((await me(forge({ aud: 'tostao-web' }))).statusCode).toBe(401); // sem iss
    expect((await me(forge({ iss: 'tostao-api' }))).statusCode).toBe(401); // sem aud
    expect((await me(forge({ ...valid, aud: 'outro-site' }))).statusCode).toBe(401);
    expect((await me(forge({ ...valid, iss: 'outro' }))).statusCode).toBe(401);
    expect((await me(forge(valid, 'HS512'))).statusCode).toBe(401); // algoritmo fora da lista
    expect((await me(forge({ ...valid, exp: 1 }))).statusCode).toBe(401); // vencido
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'x', ...valid })}.`;
    expect((await me(none)).statusCode).toBe(401);
    expect((await me(reg.accessToken)).statusCode).toBe(200);
  });

  it('POST /sessions/refresh não exige JWT; troca o par e o refresh antigo vira reuso (401) depois da janela de 30 s', async () => {
    const { app, reg } = await bootApi();
    const r = await app.inject({
      method: 'POST',
      url: '/sessions/refresh',
      payload: { refreshToken: reg.refreshToken },
    });
    expect(r.statusCode).toBe(200);
    const next = r.json();
    expect((await app.inject({ method: 'GET', url: '/me', headers: bearer(next.accessToken) })).statusCode).toBe(200);

    // T6.4: dentro de 30 s o refresh antigo ainda funciona (resposta perdida / duas abas): outro par, mesma família
    const replay = await app.inject({
      method: 'POST',
      url: '/sessions/refresh',
      payload: { refreshToken: reg.refreshToken },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().refreshToken).not.toBe(next.refreshToken);

    // passou da janela: o refresh antigo vira reuso (401) e a família cai, inclusive os pares novos
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 31_000 });
    try {
      const late = await app.inject({
        method: 'POST',
        url: '/sessions/refresh',
        payload: { refreshToken: reg.refreshToken },
      });
      expect(late.statusCode).toBe(401);
    } finally {
      vi.useRealTimers();
    }
    for (const t of [next.refreshToken, replay.json().refreshToken]) {
      const after = await app.inject({ method: 'POST', url: '/sessions/refresh', payload: { refreshToken: t } });
      expect(after.statusCode).toBe(401);
    }
    // refresh token não é access token, e access token não é refresh token
    expect((await app.inject({ method: 'GET', url: '/me', headers: bearer(reg.refreshToken) })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: '/sessions/refresh', payload: { refreshToken: next.accessToken } }))
        .statusCode,
    ).toBe(401);
  });

  it('POST /sessions/logout revoga o refresh token (204, idempotente)', async () => {
    const { app, reg } = await bootApi();
    const out = await app.inject({
      method: 'POST',
      url: '/sessions/logout',
      payload: { refreshToken: reg.refreshToken },
    });
    expect(out.statusCode).toBe(204);
    expect(
      (await app.inject({ method: 'POST', url: '/sessions/logout', payload: { refreshToken: reg.refreshToken } }))
        .statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ method: 'POST', url: '/sessions/refresh', payload: { refreshToken: reg.refreshToken } }))
        .statusCode,
    ).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/sessions/logout', payload: {} })).statusCode).toBe(400);
  });

  it('POST /sessions/logout-all exige login e revoga todos os aparelhos', async () => {
    const { app, reg } = await bootApi();
    const second = (
      await app.inject({ method: 'POST', url: '/sessions', payload: { email: 'p@x.com', password: '12345678' } })
    ).json();
    expect((await app.inject({ method: 'POST', url: '/sessions/logout-all' })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'POST', url: '/sessions/logout-all', headers: bearer(reg.accessToken) })).statusCode,
    ).toBe(204);
    for (const rt of [reg.refreshToken, second.refreshToken]) {
      expect(
        (await app.inject({ method: 'POST', url: '/sessions/refresh', payload: { refreshToken: rt } })).statusCode,
      ).toBe(401);
    }
  });

  it('redefinir a senha revoga todas as sessões antigas e já entra com sessão nova', async () => {
    const { app, email, reg } = await bootApi();
    await app.inject({ method: 'POST', url: '/password-resets', payload: { email: 'p@x.com' } });
    const url = (email.sent.find((e) => e.kind === 'password-reset') as { url: string }).url;
    const token = new URL(url).searchParams.get('token')!;
    const done = await app.inject({
      method: 'POST',
      url: '/password-resets/redeem',
      payload: { token, password: 'senha-nova-1' },
    });
    expect(done.statusCode).toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/sessions/refresh', payload: { refreshToken: reg.refreshToken } }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/sessions/refresh',
          payload: { refreshToken: done.json().refreshToken },
        })
      ).statusCode,
    ).toBe(200);
  });

  it('apagar a conta revoga os refresh tokens', async () => {
    const { app, repos, reg } = await bootApi();
    const del = await app.inject({
      method: 'POST',
      url: '/me/delete',
      headers: bearer(reg.accessToken),
      payload: { password: '12345678' },
    });
    expect(del.statusCode).toBe(200);
    expect(repos.refreshTokens.items.filter((t) => !t.revokedAt)).toHaveLength(0);
    expect(
      (await app.inject({ method: 'POST', url: '/sessions/refresh', payload: { refreshToken: reg.refreshToken } }))
        .statusCode,
    ).toBe(401);
  });
});
