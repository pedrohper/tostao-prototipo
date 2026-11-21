import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { FakeEmailGateway, type SentEmail } from '../gateways/email-gateway.js';
import { InvalidVerificationTokenError } from '../domain/errors.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { RegisterUserUseCase } from './register-user.js';
import { BackgroundTasks, SendEmailVerificationUseCase, VerifyEmailUseCase } from './email-verification.js';

const tokenOf = (e: SentEmail) => new URL((e as { url: string }).url).searchParams.get('token')!;

async function setup() {
  const repos = makeInMemoryRepositories();
  const email = new FakeEmailGateway();
  let now = new Date('2026-11-20T12:00:00Z');
  const tasks = new BackgroundTasks();
  const send = new SendEmailVerificationUseCase(repos, email, 'https://tostao.test', tasks, () => now);
  const verify = new VerifyEmailUseCase(repos, () => now);
  const register = new RegisterUserUseCase(repos, send);
  return { repos, email, send, verify, register, tasks, tick: (ms: number) => (now = new Date(now.getTime() + ms)) };
}

describe('verificação de e-mail', () => {
  it('cadastro gera token de 256 bits (24 h), guarda só o hash e envia o link', async () => {
    const { repos, email, register, tasks } = await setup();
    const { user } = await register.execute({ name: 'Ana', email: 'a@x.com', password: '12345678' });
    await tasks.drain();
    expect(user.emailVerifiedAt).toBeNull();
    const sent = email.sent[0]!;
    expect(sent).toMatchObject({ kind: 'email-verification', to: 'a@x.com' });
    const token = tokenOf(sent);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new URL((sent as { url: string }).url).pathname).toBe('/verificar-email');
    const row = repos.emailVerifications.items[0]!;
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.expiresAt.getTime()).toBe(new Date('2026-11-21T12:00:00Z').getTime());
  });

  it('e-mail fora do ar não impede o cadastro', async () => {
    const { email, register, repos, tasks } = await setup();
    email.sendEmailVerification = async () => {
      throw new Error('fora do ar');
    };
    await expect(register.execute({ name: 'Ana', email: 'a@x.com', password: '12345678' })).resolves.toHaveProperty(
      'user',
    );
    await tasks.drain();
    expect(await repos.users.count()).toBe(1);
  });

  it('o link confirma o e-mail uma vez só', async () => {
    const { repos, email, register, verify, tasks } = await setup();
    const { user } = await register.execute({ name: 'Ana', email: 'a@x.com', password: '12345678' });
    await tasks.drain();
    const token = tokenOf(email.sent[0]!);
    await verify.execute({ token });
    expect((await repos.users.findById(user.id))!.emailVerifiedAt).not.toBeNull();
    await expect(verify.execute({ token })).rejects.toBeInstanceOf(InvalidVerificationTokenError);
  });

  it('token inventado é recusado; 2 usos simultâneos do mesmo link: só 1 passa', async () => {
    const { email, register, verify, tasks } = await setup();
    await register.execute({ name: 'Ana', email: 'a@x.com', password: '12345678' });
    await tasks.drain();
    const token = tokenOf(email.sent[0]!);
    await expect(verify.execute({ token: 'z'.repeat(43) })).rejects.toBeInstanceOf(InvalidVerificationTokenError);
    const results = await Promise.allSettled([verify.execute({ token }), verify.execute({ token })]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('link vencido (24 h + 1 ms) é recusado', async () => {
    const { email, register, verify, tasks, tick } = await setup();
    await register.execute({ name: 'Ana', email: 'a@x.com', password: '12345678' });
    await tasks.drain();
    const token = tokenOf(email.sent[0]!);
    tick(24 * 3600_000 + 1);
    await expect(verify.execute({ token })).rejects.toBeInstanceOf(InvalidVerificationTokenError);
  });

  it('reenviar invalida o link anterior; conta já verificada não recebe e-mail', async () => {
    const { repos, email, register, send, verify, tasks } = await setup();
    const { user } = await register.execute({ name: 'Ana', email: 'a@x.com', password: '12345678' });
    await tasks.drain();
    const first = tokenOf(email.sent[0]!);
    expect(await send.execute({ userId: user.id })).toBe(true);
    await tasks.drain();
    const second = tokenOf(email.sent[1]!);
    await expect(verify.execute({ token: first })).rejects.toBeInstanceOf(InvalidVerificationTokenError);
    await verify.execute({ token: second });
    expect(await send.execute({ userId: user.id })).toBe(false);
    expect(await send.execute({ userId: 'nao-existe' })).toBe(false);
    expect(email.sent).toHaveLength(2);
    expect((await repos.users.findById(user.id))!.emailVerifiedAt).not.toBeNull();
  });
});

describe('verificação de e-mail (HTTP)', () => {
  it('cadastro → e-mail → POST /auth/verify-email → /me mostra verificado; reenvio exige login e tem limite', async () => {
    const repos = makeInMemoryRepositories();
    const email = new FakeEmailGateway();
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
      webOrigin: 'https://tostao.test',
      email,
    });
    const reg = (
      await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'Ana', email: 'a@x.com', password: '12345678', acceptedTerms: true },
      })
    ).json();
    const auth = { authorization: `Bearer ${reg.accessToken}` };
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().emailVerifiedAt).toBeNull();

    // reenvio: exige login; 202 igual
    expect((await app.inject({ method: 'POST', url: '/auth/resend-verification' })).statusCode).toBe(401);
    const resend = await app.inject({ method: 'POST', url: '/auth/resend-verification', headers: auth });
    expect(resend.statusCode).toBe(202);
    await new Promise((r) => setTimeout(r, 0));
    const verification = email.sent.filter((e) => e.kind === 'email-verification');
    expect(verification).toHaveLength(2);

    const bad = await app.inject({ method: 'POST', url: '/auth/verify-email', payload: { token: 'a'.repeat(43) } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({
      method: 'POST',
      url: '/auth/verify-email',
      payload: { token: tokenOf(verification[1]!) },
    });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/me', headers: auth })).json().emailVerifiedAt).toEqual(
      expect.any(String),
    );

    // limite: 5 por 15 min por usuário (1 já usado acima)
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++)
      statuses.push((await app.inject({ method: 'POST', url: '/auth/resend-verification', headers: auth })).statusCode);
    expect(statuses).toEqual([202, 202, 202, 202, 429]);
  });

  it('senha acima de 72 caracteres/bytes é 400 no cadastro, no login e na redefinição', async () => {
    const app = await buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
      webOrigin: '*',
    });
    const big = 'a'.repeat(73);
    const bytes = 'ç'.repeat(40);
    for (const password of [big, bytes]) {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/users',
            payload: { name: 'Ana', email: 'a@x.com', password, acceptedTerms: true },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await app.inject({ method: 'POST', url: '/sessions', payload: { email: 'a@x.com', password } })).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/password-resets/redeem',
            payload: { token: 'a'.repeat(43), password },
          })
        ).statusCode,
      ).toBe(400);
    }
    const ok72 = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Ana', email: 'a@x.com', password: 'a'.repeat(72), acceptedTerms: true },
    });
    expect(ok72.statusCode).toBe(201);
  });
});
