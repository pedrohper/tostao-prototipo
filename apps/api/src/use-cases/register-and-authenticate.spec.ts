import { beforeEach, describe, expect, it } from 'vitest';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { RegisterUserUseCase } from './register-user.js';
import { AuthenticateUseCase } from './authenticate.js';
import { CreateInviteUseCase } from './invites.js';
import { InvalidResetTokenError, RequestPasswordResetUseCase, ResetPasswordUseCase } from './password-reset.js';
import { FakeEmailGateway } from '../gateways/email-gateway.js';
import { EmailAlreadyInUseError, InvalidCredentialsError } from '../domain/errors.js';

describe('cadastro e login', () => {
  let repos: ReturnType<typeof makeInMemoryRepositories>;
  beforeEach(() => {
    repos = makeInMemoryRepositories();
  });
  const dono = () => new RegisterUserUseCase(repos).execute({ name: 'Pedro', email: 'p@x.com', password: '12345678' });

  it('guarda hash, nunca a senha', async () => {
    const { user } = await dono();
    expect(user.passwordHash).not.toBe('12345678');
  });

  it('cadastro aberto: convite é opcional, marca quem chamou e código ruim não trava', async () => {
    const { user } = await dono();
    const register = new RegisterUserUseCase(repos);
    await register.execute({ name: 'Ana', email: 'a@x.com', password: '12345678' });
    await register.execute({ name: 'Caio', email: 'c@x.com', password: '12345678', inviteCode: 'TOST-NADA-NADA' });

    const { invite } = await new CreateInviteUseCase(repos).execute({ userId: user.id });
    const { user: bia } = await register.execute({
      name: 'Bia',
      email: 'b@x.com',
      password: '12345678',
      inviteCode: ` ${invite.code.toLowerCase()} `,
    });
    expect(repos.invites.items[0]!.usedById).toBe(bia.id);
    await register.execute({ name: 'Duda', email: 'd@x.com', password: '12345678', inviteCode: invite.code });
    expect(repos.invites.items[0]!.usedById).toBe(bia.id);
  });

  it('não deixa repetir e-mail', async () => {
    const { user } = await dono();
    const { invite } = await new CreateInviteUseCase(repos).execute({ userId: user.id });
    await expect(
      new RegisterUserUseCase(repos).execute({
        name: 'Outro',
        email: 'p@x.com',
        password: '12345678',
        inviteCode: invite.code,
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it('entra com a senha certa e recusa a errada', async () => {
    await dono();
    const auth = new AuthenticateUseCase(repos.users);
    await expect(auth.execute({ email: 'p@x.com', password: '12345678' })).resolves.toHaveProperty('user');
    await expect(auth.execute({ email: 'p@x.com', password: 'errada00' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    await expect(auth.execute({ email: 'nao@existe.com', password: '12345678' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it('link de nova senha: funciona uma vez e expira em 1 h', async () => {
    await dono();
    let now = new Date('2026-11-12T12:00:00Z');
    const clock = () => now;
    const email = new FakeEmailGateway();
    const request = new RequestPasswordResetUseCase(repos, email, 'https://tostao.test', undefined, clock);
    const tokenOf = async () => {
      await request.execute({ email: 'P@x.com' });
      await request.tasks.drain();
      return new URL(
        email.sent.at(-1)!.kind === 'password-reset' ? (email.sent.at(-1) as { url: string }).url : '',
      ).searchParams.get('token')!;
    };
    const token = await tokenOf();
    expect(repos.passwordResets.items[0]!.tokenHash).not.toBe(token);

    const reset = new ResetPasswordUseCase(repos, undefined, undefined, clock);
    await reset.execute({ token, password: 'novasenha1' });
    await expect(
      new AuthenticateUseCase(repos.users).execute({ email: 'p@x.com', password: 'novasenha1' }),
    ).resolves.toHaveProperty('user');
    await expect(reset.execute({ token, password: 'outra1234' })).rejects.toBeInstanceOf(InvalidResetTokenError);

    const late = await tokenOf();
    now = new Date('2026-11-12T13:00:01Z');
    await expect(reset.execute({ token: late, password: 'outra1234' })).rejects.toBeInstanceOf(InvalidResetTokenError);
  });
});
