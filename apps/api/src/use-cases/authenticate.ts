import bcrypt from 'bcryptjs';
import type { UsersRepository } from '../repositories/types.js';
import { InvalidCredentialsError } from '../domain/errors.js';

export class AuthenticateUseCase {
  constructor(private readonly users: UsersRepository) {}

  async execute({ email, password }: { email: string; password: string }) {
    const user = await this.users.findByEmail(email);
    // Mesmo erro pra "e-mail não existe" e "senha errada": não entrega quais e-mails têm conta.
    if (!user) throw new InvalidCredentialsError();
    if (!(await bcrypt.compare(password, user.passwordHash))) throw new InvalidCredentialsError();
    return { user };
  }
}
