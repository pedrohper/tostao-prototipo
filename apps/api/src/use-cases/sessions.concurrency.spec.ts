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

  it('refresh simultâneo com o mesmo token: só 1 recebe o par novo; o outro conta como reuso e derruba a família', async () => {
    const repos = makePrismaRepositories(db);
    const user = await newUser(`refresh-${Date.now()}@x.com`);
    const sessions = new SessionsUseCase(repos);
    const { refreshToken } = await sessions.open(user.id);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => sessions.rotate(refreshToken)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // os perdedores chegaram depois do vencedor ter revogado o token => reuso => família inteira revogada
    expect(await db.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    expect(await db.refreshToken.count({ where: { userId: user.id } })).toBe(2);
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
