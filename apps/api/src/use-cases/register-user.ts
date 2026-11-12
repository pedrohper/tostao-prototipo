import bcrypt from 'bcryptjs';
import type { Repositories } from '../repositories/types.js';
import { AppError, EmailAlreadyInUseError } from '../domain/errors.js';
import { normalizeInviteCode } from './invites.js';

type Input = { name: string; email: string; password: string; inviteCode?: string | null };

export class InvalidInviteError extends AppError {
  constructor() { super('Convite inválido ou já usado. Pede um novo pra quem te chamou.', 403); }
}

/**
 * Cadastro só por convite. Exceção: a primeira conta do servidor (o dono) entra sem.
 */
export class RegisterUserUseCase {
  constructor(private readonly repos: Pick<Repositories, 'users' | 'invites'>) {}

  async execute({ name, email, password, inviteCode }: Input) {
    const { users, invites } = this.repos;
    const isFirst = (await users.count()) === 0;
    const code = inviteCode ? normalizeInviteCode(inviteCode) : '';
    if (!isFirst) {
      const invite = code ? await invites.findByCode(code) : null;
      if (!invite || invite.usedById) throw new InvalidInviteError();
    }
    if (await users.findByEmail(email)) throw new EmailAlreadyInUseError();
    // Nunca guarde senha. Guarde o hash (bcrypt, custo 10 = ~100ms, lento de propósito pra dificultar força bruta).
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await users.create({ name, email, passwordHash });
    if (!isFirst) await invites.markUsed(code, user.id);
    return { user };
  }
}
