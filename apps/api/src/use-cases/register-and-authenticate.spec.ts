import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryUsersRepository } from '../repositories/in-memory/index.js';
import { RegisterUserUseCase } from './register-user.js';
import { AuthenticateUseCase } from './authenticate.js';
import { EmailAlreadyInUseError, InvalidCredentialsError } from '../domain/errors.js';

describe('cadastro e login', () => {
  let users: InMemoryUsersRepository;
  beforeEach(() => { users = new InMemoryUsersRepository(); });

  it('guarda hash, nunca a senha', async () => {
    const { user } = await new RegisterUserUseCase(users).execute({ name: 'Pedro', email: 'p@x.com', password: '12345678' });
    expect(user.passwordHash).not.toBe('12345678');
  });
  it('não deixa repetir e-mail', async () => {
    const register = new RegisterUserUseCase(users);
    await register.execute({ name: 'Pedro', email: 'p@x.com', password: '12345678' });
    await expect(register.execute({ name: 'Outro', email: 'p@x.com', password: '12345678' })).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });
  it('entra com a senha certa e recusa a errada', async () => {
    await new RegisterUserUseCase(users).execute({ name: 'Pedro', email: 'p@x.com', password: '12345678' });
    const auth = new AuthenticateUseCase(users);
    await expect(auth.execute({ email: 'p@x.com', password: '12345678' })).resolves.toHaveProperty('user');
    await expect(auth.execute({ email: 'p@x.com', password: 'errada00' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(auth.execute({ email: 'nao@existe.com', password: '12345678' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
