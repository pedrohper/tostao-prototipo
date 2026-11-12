import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Repositories } from '../repositories/types.js';
import { AppError, ResourceNotFoundError } from '../domain/errors.js';

const ONE_HOUR = 60 * 60 * 1000;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Gera o link de "esqueci a senha". Sem servidor de e-mail ainda, quem roda é o dono do servidor
 * (pnpm --filter @tostao/api reset-link email) e manda o link pra pessoa.
 * Guardamos só o hash: quem ler o banco não consegue usar o link.
 */
export class CreatePasswordResetUseCase {
  constructor(private readonly repos: Pick<Repositories, 'users' | 'passwordResets'>, private readonly now = () => new Date()) {}

  async execute({ email }: { email: string }) {
    const user = await this.repos.users.findByEmail(email.trim().toLowerCase());
    if (!user) throw new ResourceNotFoundError('Usuário');
    const token = randomBytes(32).toString('base64url');
    await this.repos.passwordResets.create({ userId: user.id, tokenHash: hash(token), expiresAt: new Date(this.now().getTime() + ONE_HOUR) });
    return { token, user };
  }
}

export class InvalidResetTokenError extends AppError {
  constructor() { super('Esse link expirou ou já foi usado. Pede um novo.', 400); }
}

export class ResetPasswordUseCase {
  constructor(private readonly repos: Pick<Repositories, 'users' | 'passwordResets'>, private readonly now = () => new Date()) {}

  async execute({ token, password }: { token: string; password: string }) {
    const reset = await this.repos.passwordResets.findByTokenHash(hash(token));
    if (!reset || reset.usedAt || reset.expiresAt <= this.now()) throw new InvalidResetTokenError();
    await this.repos.users.updatePassword(reset.userId, await bcrypt.hash(password, 10));
    await this.repos.passwordResets.markUsed(reset.id);
    return { userId: reset.userId };
  }
}
