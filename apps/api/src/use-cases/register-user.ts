import bcrypt from 'bcryptjs';
import type { Repositories } from '../repositories/types.js';
import { EmailAlreadyInUseError } from '../domain/errors.js';
import { normalizeInviteCode } from './invites.js';

type Input = { name: string; email: string; password: string; inviteCode?: string | null };

/**
 * Cadastro aberto. O convite é opcional: se vier um código válido, fica marcado quem chamou quem.
 * Código inválido ou já usado não trava ninguém, só é ignorado. Quem chamou e quem entrou viram amigos.
 */
export class RegisterUserUseCase {
  constructor(private readonly repos: Pick<Repositories, 'users' | 'invites' | 'engagement'>) {}

  async execute({ name, email, password, inviteCode }: Input) {
    const { users, invites } = this.repos;
    const code = inviteCode ? normalizeInviteCode(inviteCode) : '';
    const invite = code ? await invites.findByCode(code) : null;
    if (await users.findByEmail(email)) throw new EmailAlreadyInUseError();
    // Nunca guarde senha. Guarde o hash (bcrypt, custo 10 = ~100ms, lento de propósito pra dificultar força bruta).
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await users.create({ name, email, passwordHash });
    if (invite && !invite.usedById) {
      await invites.markUsed(code, user.id);
      await this.repos.engagement.addFriend(invite.createdById, user.id);
    } else if (code) {
      // Link de amigo (código da tela Amigos) também serve: já entra como amigo de quem chamou.
      const friendId = await this.repos.engagement.findUserByFriendCode(code);
      if (friendId) await this.repos.engagement.addFriend(friendId, user.id);
    }
    return { user };
  }
}
