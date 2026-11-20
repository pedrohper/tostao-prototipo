import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import { FakeEmailGateway, type SentEmail } from '../gateways/email-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { AuthenticateUseCase } from './authenticate.js';
import { BackgroundTasks } from './email-verification.js';
import { InvalidResetTokenError, RequestPasswordResetUseCase, ResetPasswordUseCase } from './password-reset.js';
import { SessionsUseCase } from './sessions.js';

const tokenOf = (e: SentEmail) => new URL((e as { url: string }).url).searchParams.get('token')!;

async function setup() {
  const repos = makeInMemoryRepositories();
  const email = new FakeEmailGateway();
  const user = await repos.users.create({
    name: 'Pedro Silva',
    email: 'p@x.com',
    passwordHash: await hashPassword('senha-antiga'),
  });
  let now = new Date('2026-11-20T12:00:00Z');
  const tasks = new BackgroundTasks();
  const request = new RequestPasswordResetUseCase(repos, email, 'https://tostao.test', tasks, () => now);
  const reset = new ResetPasswordUseCase(repos, email, tasks, () => now);
  const issue = async () => {
    await request.execute({ email: 'p@x.com' });
    await tasks.drain();
    return tokenOf(email.sent.filter((e) => e.kind === 'password-reset').at(-1)!);
  };
  return {
    repos,
    email,
    user,
    request,
    reset,
    issue,
    tasks,
    tick: (ms: number) => (now = new Date(now.getTime() + ms)),
  };
}

describe('redefinir senha (ResetPasswordUseCase)', () => {
  it('2 resgates simultâneos do mesmo link: só 1 sucede e a senha final é a do vencedor', async () => {
    const { repos, user, reset, issue } = await setup();
    const token = await issue();
    const results = await Promise.allSettled([
      reset.execute({ token, password: 'vencedora-1' }),
      reset.execute({ token, password: 'vencedora-2' }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.reason).toBeInstanceOf(InvalidResetTokenError);

    const winner = results[0]!.status === 'fulfilled' ? 'vencedora-1' : 'vencedora-2';
    const stored = (await repos.users.findById(user.id))!.passwordHash!;
    expect(await verifyPassword(winner, stored)).toBe(true);
    expect(await verifyPassword(winner === 'vencedora-1' ? 'vencedora-2' : 'vencedora-1', stored)).toBe(false);
  });

  it('muitos resgates em paralelo: ainda só 1 passa', async () => {
    const { reset, issue } = await setup();
    const token = await issue();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) => reset.execute({ token, password: `senha-nova-${i}` })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('um pedido novo invalida os links anteriores (só o último vale)', async () => {
    const { reset, issue } = await setup();
    const first = await issue();
    const second = await issue();
    await expect(reset.execute({ token: first, password: 'senha-nova-1' })).rejects.toBeInstanceOf(
      InvalidResetTokenError,
    );
    await expect(reset.execute({ token: second, password: 'senha-nova-1' })).resolves.toHaveProperty('userId');
  });

  it('link vale 1 h e é de uso único', async () => {
    const { reset, issue, tick } = await setup();
    const token = await issue();
    tick(60 * 60_000 + 1);
    await expect(reset.execute({ token, password: 'senha-nova-1' })).rejects.toBeInstanceOf(InvalidResetTokenError);
    const again = await issue();
    await reset.execute({ token: again, password: 'senha-nova-1' });
    await expect(reset.execute({ token: again, password: 'senha-nova-2' })).rejects.toBeInstanceOf(
      InvalidResetTokenError,
    );
    await expect(reset.execute({ token: 'x'.repeat(43), password: 'senha-nova-2' })).rejects.toBeInstanceOf(
      InvalidResetTokenError,
    );
  });

  it('troca a senha, revoga TODAS as sessões, confirma o e-mail e avisa por e-mail', async () => {
    const { repos, email, user, reset, issue, tasks } = await setup();
    const sessions = new SessionsUseCase(repos);
    const { refreshToken: a } = await sessions.open(user.id);
    const { refreshToken: b } = await sessions.open(user.id);
    const token = await issue();
    await reset.execute({ token, password: 'senha-nova-1' });
    await tasks.drain();

    await expect(sessions.rotate(a)).rejects.toThrow();
    await expect(sessions.rotate(b)).rejects.toThrow();
    expect(repos.refreshTokens.items.every((t) => t.revokedAt)).toBe(true);
    expect((await repos.users.findById(user.id))!.emailVerifiedAt).not.toBeNull();
    expect(email.sent.at(-1)).toEqual({ kind: 'security-alert', to: 'p@x.com', event: 'password_changed' });

    const auth = new AuthenticateUseCase(repos.users);
    await expect(auth.execute({ email: 'p@x.com', password: 'senha-antiga' })).rejects.toThrow();
    await expect(auth.execute({ email: 'p@x.com', password: 'senha-nova-1' })).resolves.toHaveProperty('user');
  });

  it('o token no banco é só o hash e o e-mail leva o link com o token real', async () => {
    const { repos, issue } = await setup();
    const token = await issue();
    expect(JSON.stringify(repos.passwordResets.items)).not.toContain(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('POST /password-resets: anti-enumeração (HTTP)', () => {
  async function boot() {
    const repos = makeInMemoryRepositories();
    const email = new FakeEmailGateway();
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
      webOrigin: 'https://tostao.test',
      email,
    });
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'p@x.com', password: '12345678', acceptedTerms: true },
    });
    email.sent.length = 0; // descarta o e-mail de verificação do cadastro
    return { app, repos, email };
  }
  const post = (app: Awaited<ReturnType<typeof boot>>['app'], email: string) =>
    app.inject({ method: 'POST', url: '/password-resets', payload: { email } });

  it('e-mail com conta e e-mail sem conta recebem resposta idêntica (202 + mesma mensagem + mesmos headers úteis)', async () => {
    const { app, email } = await boot();
    const existing = await post(app, 'p@x.com');
    const missing = await post(app, 'ninguem@x.com');
    expect(existing.statusCode).toBe(202);
    expect(missing.statusCode).toBe(202);
    expect(missing.body).toBe(existing.body);
    expect(missing.headers['content-type']).toBe(existing.headers['content-type']);
    expect(Object.keys(existing.json())).toEqual(['message']);
    // só quem tem conta recebe e-mail (e a resposta não depende disso)
    await app.close();
    expect(email.sent.filter((e) => e.kind === 'password-reset')).toHaveLength(1);
    expect(email.sent.find((e) => e.kind === 'password-reset')!.to).toBe('p@x.com');
  });

  it('maiúsculas/espaços no e-mail não mudam a resposta; e-mail malformado é 400 igual pra todos', async () => {
    const { app } = await boot();
    const a = await post(app, 'P@X.com');
    const b = await post(app, 'Fantasma@X.com');
    expect(a.body).toBe(b.body);
    expect((await post(app, 'nao-e-email')).statusCode).toBe(400);
  });

  it('o limite por e-mail (5 por 15 min) é igual com ou sem conta: não vira oráculo', async () => {
    const { app } = await boot();
    let n = 0;
    // IPs diferentes a cada pedido: isola o limite POR E-MAIL (o por IP tem teste próprio)
    const send = (address: string) =>
      app.inject({
        method: 'POST',
        url: '/password-resets',
        headers: { 'x-forwarded-for': `10.2.0.${++n}` },
        payload: { email: address },
      });
    for (const address of ['p@x.com', 'ninguem@x.com']) {
      const statuses: number[] = [];
      for (let i = 0; i < 7; i++) statuses.push((await send(address)).statusCode);
      expect(statuses).toEqual([202, 202, 202, 202, 202, 429, 429]);
    }
  });

  it('o limite por IP (5 por 15 min) vale pra qualquer e-mail', async () => {
    const { app } = await boot();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push(
        (
          await app.inject({
            method: 'POST',
            url: '/password-resets',
            headers: { 'x-forwarded-for': '10.3.0.1' },
            payload: { email: `pessoa${i}@x.com` },
          })
        ).statusCode,
      );
    }
    expect(statuses).toEqual([202, 202, 202, 202, 202, 429, 429]);
  });

  it('fluxo completo: pedido → e-mail com link → /redefinir-senha?token → senha nova → entra', async () => {
    const { app, email } = await boot();
    await post(app, 'p@x.com');
    const sent = email.sent.find((e) => e.kind === 'password-reset')! as { url: string };
    const url = new URL(sent.url);
    expect(url.origin + url.pathname).toBe('https://tostao.test/redefinir-senha');

    const done = await app.inject({
      method: 'POST',
      url: '/password-resets/redeem',
      payload: { token: url.searchParams.get('token'), password: 'senha-nova-1' },
    });
    expect(done.statusCode).toBe(200);
    expect(done.json()).toHaveProperty('accessToken');
    const login = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { email: 'p@x.com', password: 'senha-nova-1' },
    });
    expect(login.statusCode).toBe(200);
    // o mesmo link não funciona de novo
    const again = await app.inject({
      method: 'POST',
      url: '/password-resets/redeem',
      payload: { token: url.searchParams.get('token'), password: 'outra-senha-9' },
    });
    expect(again.statusCode).toBe(400);
  });

  it('falha do provedor de e-mail não vaza na resposta nem derruba o pedido', async () => {
    const repos = makeInMemoryRepositories();
    const email = new FakeEmailGateway();
    email.sendPasswordReset = async () => {
      throw new Error('resend fora do ar');
    };
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-com-32-caracteres!!',
      webOrigin: 'https://tostao.test',
      email,
    });
    await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'p@x.com', password: '12345678', acceptedTerms: true },
    });
    const r = await post(app, 'p@x.com');
    expect(r.statusCode).toBe(202);
  });
});
