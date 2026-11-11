import bcrypt from 'bcryptjs';
import type { UsersRepository } from '../repositories/types.js';
import { EmailAlreadyInUseError } from '../domain/errors.js';

type Input = { name: string; email: string; password: string };

export class RegisterUserUseCase {
  constructor(private readonly users: UsersRepository) {}

  async execute({ name, email, password }: Input) {
    if (await this.users.findByEmail(email)) throw new EmailAlreadyInUseError();
    // Nunca guarde senha. Guarde o hash (bcrypt, custo 10 = ~100ms, lento de propósito pra dificultar força bruta).
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.create({ name, email, passwordHash });
    return { user };
  }
}
