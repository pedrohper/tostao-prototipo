// Concorrência de verdade, contra Postgres REAL: o repositório em memória só prova a lógica; aqui o que garante
// "só um vence" é o UPDATE condicional dentro de $transaction. Só roda com TEST_DATABASE_URL (banco descartável).
//   docker run -d --rm -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tostao_test -p 127.0.0.1:55432:5432 postgres:16
//   DATABASE_URL=<url> pnpm --filter @tostao/api db:deploy
//   TEST_DATABASE_URL=<url> pnpm --filter @tostao/api test sessions.concurrency
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailGateway } from '../gateways/email-gateway.js';
import { hashPassword } from '../lib/password.js';
import { makePrismaRepositories } from '../repositories/prisma/index.js';
import { BackgroundTasks, SendEmailVerificationUseCase, VerifyEmailUseCase } from './email-verification.js';
import { RequestPasswordResetUseCase, ResetPasswordUseCase } from './password-reset.js';
import { SessionsUseCase } from './sessions.js';

const url = process.env.TEST_DATABASE_URL;
const tokenOf = (u: string) => new URL(u).searchParams.get('token')!;

describe.skipIf(!url)('sessão, reset e verificação: concorrência no Postgres real', () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = new PrismaClient({ datasourceUrl: url });
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  const newUser = async (email: string) =>
    db.user.create({ data: { name: 'Pessoa', email, passwordHash: await hashPassword('senha-antiga-1') } });

  it('2 resgates simultâneos do mesmo link de reset: só 1 sucede; sessões revogadas; e-mail verificado', async () => {
    const repos = makePrismaRepositories(db);
    const user = await newUser(`reset-${Date.now()}@x.com`);
    const sessions = new SessionsUseCase(repos);
    const { refreshToken } = await sessions.open(user.id);
    const email = new FakeEmailGateway();
    const tasks = new BackgroundTasks();
    await new RequestPasswordResetUseCase(repos, email, 'https://t.test', tasks).execute({ email: user.email });
    await tasks.drain();
    const token = tokenOf((email.sent[0] as { url: string }).url);

    const reset = new ResetPasswordUseCase(repos, undefined, tasks);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) => reset.execute({ token, password: `senha-nova-${i}-x` })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    await expect(sessions.rotate(refreshToken)).rejects.toThrow();
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.emailVerifiedAt).not.toBeNull();
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });

  it('refresh simultâneo com o mesmo token (abas): todos recebem token na mesma família, sem derrubar a sessão (T6.4)', async () => {
    const repos = makePrismaRepositories(db);
    const user = await newUser(`refresh-${Date.now()}@x.com`);
    const sessions = new SessionsUseCase(repos);
    const { refreshToken } = await sessions.open(user.id);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => sessions.rotate(refreshToken)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const rows = await db.refreshToken.findMany({ where: { userId: user.id } });
    expect(new Set(rows.map((r) => r.familyId)).size).toBe(1);
    expect(rows).toHaveLength(6); // o original (revogado) + 5 filhos vivos
    expect(rows.filter((r) => !r.revokedAt)).toHaveLength(5);
    expect(await db.auditLog.count({ where: { userId: user.id, action: 'refresh_reuse_detected' } })).toBe(0);
    expect(await db.auditLog.count({ where: { userId: user.id, action: 'refresh_grace_used' } })).toBe(4);
  });

  it('janela de 30 s no Postgres: reuso em 5 s passa; em 31 s derruba a família; filho já usado derruba', async () => {
    const repos = makePrismaRepositories(db);
    const t0 = new Date();
    const at = (ms: number) => new SessionsUseCase(repos, () => new Date(t0.getTime() + ms));

    const a = await newUser(`grace-a-${Date.now()}@x.com`);
    const { refreshToken: pa } = await at(0).open(a.id);
    await at(0).rotate(pa);
    await expect(at(5_000).rotate(pa)).resolves.toHaveProperty('userId');
    expect(await db.refreshToken.count({ where: { userId: a.id, revokedAt: null } })).toBe(2);
    await expect(at(31_000).rotate(pa)).rejects.toThrow();
    expect(await db.refreshToken.count({ where: { userId: a.id, revokedAt: null } })).toBe(0);
    expect(await db.auditLog.count({ where: { userId: a.id, action: 'refresh_reuse_detected' } })).toBe(1);

    const b = await newUser(`grace-b-${Date.now()}@x.com`);
    const { refreshToken: pb } = await at(0).open(b.id);
    const child = await at(0).rotate(pb);
    await at(1_000).rotate(child.refreshToken); // o filho já foi usado
    await expect(at(5_000).rotate(pb)).rejects.toThrow();
    expect(await db.refreshToken.count({ where: { userId: b.id, revokedAt: null } })).toBe(0);
  });

  it('depois da janela só um ramo sobrevive: renovar um irmão mata o outro, e reapresentá-lo derruba a família', async () => {
    const repos = makePrismaRepositories(db);
    const user = await newUser(`branch-${Date.now()}@x.com`);
    const sessions = new SessionsUseCase(repos);
    const { refreshToken: p } = await sessions.open(user.id);
    const first = await sessions.rotate(p);
    const sibling = await sessions.rotate(p);
    await sessions.rotate(sibling.refreshToken);
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(1);
    await expect(sessions.rotate(first.refreshToken)).rejects.toThrow();
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });

  it('logout e logout-all simultâneos à renovação não deixam token vivo', async () => {
    const repos = makePrismaRepositories(db);
    const user = await newUser(`race-${Date.now()}@x.com`);
    const sessions = new SessionsUseCase(repos);
    for (let i = 0; i < 20; i++) {
      const { refreshToken } = await sessions.open(user.id);
      await Promise.allSettled([
        sessions.rotate(refreshToken),
        i % 2 === 0 ? sessions.logout(refreshToken) : sessions.logoutAll(user.id),
      ]);
      expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    }
  });

  it('rotação mantém a família e encadeia replacedById; apagar o usuário leva os tokens (cascade)', async () => {
    const repos = makePrismaRepositories(db);
    const user = await newUser(`chain-${Date.now()}@x.com`);
    const sessions = new SessionsUseCase(repos);
    const { refreshToken: a } = await sessions.open(user.id);
    const { refreshToken: b } = await sessions.rotate(a);
    await sessions.rotate(b);
    const rows = await db.refreshToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    expect(new Set(rows.map((r) => r.familyId)).size).toBe(1);
    expect(rows[0]!.replacedById).toBe(rows[1]!.id);
    await db.user.delete({ where: { id: user.id } });
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it('verificação de e-mail: 2 cliques simultâneos, só 1 passa', async () => {
    const repos = makePrismaRepositories(db);
    const user = await newUser(`verify-${Date.now()}@x.com`);
    const email = new FakeEmailGateway();
    const tasks = new BackgroundTasks();
    await new SendEmailVerificationUseCase(repos, email, 'https://t.test', tasks).execute({ userId: user.id });
    await tasks.drain();
    const token = tokenOf((email.sent[0] as { url: string }).url);
    const verify = new VerifyEmailUseCase(repos);
    const results = await Promise.allSettled([
      verify.execute({ token }),
      verify.execute({ token }),
      verify.execute({ token }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).not.toBeNull();
  });
});
