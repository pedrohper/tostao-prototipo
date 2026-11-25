import type { Repositories } from '../repositories/types.js';
import { EmailAlreadyInUseError } from '../domain/errors.js';
import { hashPassword } from '../lib/password.js';
import { normalizeInviteCode } from './invites.js';

/** Versão do texto de Termos/Privacidade aceito no cadastro. Mude quando os textos legais mudarem. */
export const TERMS_VERSION = '2026-11-25';

type Input = { name: string; email: string; password: string; inviteCode?: string | null };

/**
 * Cadastro aberto. O convite é opcional: se vier um código válido, fica marcado quem chamou quem.
 * Código inválido ou já usado não trava ninguém, só é ignorado. Quem chamou e quem entrou viram amigos.
 */
export class RegisterUserUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'invites' | 'engagement' | 'consents' | 'tx'>,
    /** Manda o link de verificação do e-mail (em segundo plano: e-mail fora do ar não impede o cadastro). */
    private readonly verification?: { execute(input: { userId: string }): Promise<boolean> },
  ) {}

  async execute({ name, email, password, inviteCode }: Input) {
    const { users, invites } = this.repos;
    const code = inviteCode ? normalizeInviteCode(inviteCode) : '';
    const invite = code ? await invites.findByCode(code) : null;
    if (await users.findByEmail(email)) throw new EmailAlreadyInUseError();
    // Nunca guarde senha. Guarde o hash (bcrypt, lento de propósito pra dificultar força bruta).
    const passwordHash = await hashPassword(password);
    const now = new Date();
    let user;
    try {
      // Conta + consentimento + convite + amizade: tudo ou nada. Nunca fica conta sem aceite registrado,
      // nem convite consumido sem a pessoa ter entrado.
      user = await this.repos.tx(async (r) => {
        const created = await r.users.create({
          name,
          email,
          passwordHash,
          termsAcceptedAt: now,
          termsVersion: TERMS_VERSION,
        });
        await r.consents.grant({ userId: created.id, type: 'terms', version: TERMS_VERSION, at: now });
        await r.consents.grant({ userId: created.id, type: 'privacy', version: TERMS_VERSION, at: now });
        // O que manda é used_at: convite já usado (mesmo que o convidado tenha apagado a conta) não reabre.
        const claimed = invite && !invite.usedAt && !invite.usedById && (await r.invites.markUsed(code, created.id));
        if (claimed) {
          if (invite.createdById) await r.engagement.addFriend(invite.createdById, created.id);
        } else if (code) {
          // Link de amigo (código da tela Amigos) também serve: já entra como amigo de quem chamou.
          const friendId = await r.engagement.findUserByFriendCode(code);
          if (friendId) await r.engagement.addFriend(friendId, created.id);
        }
        return created;
      });
    } catch (err) {
      // Duas inscrições com o mesmo e-mail ao mesmo tempo: o índice único (case-insensitive) barra a segunda.
      if ((err as { code?: string }).code === 'P2002') throw new EmailAlreadyInUseError();
      throw err;
    }
    // Cadastro por senha nasce sem e-mail verificado: o link prova que a caixa de entrada é da pessoa.
    await this.verification?.execute({ userId: user.id }).catch(() => false);
    return { user };
  }
}
