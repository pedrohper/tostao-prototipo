import type { UsersRepository } from '../repositories/types.js';
import { InvalidCredentialsError } from '../domain/errors.js';
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from '../lib/password.js';

export class AuthenticateUseCase {
  constructor(private readonly users: UsersRepository) {}

  async execute({ email, password }: { email: string; password: string }) {
    const user = await this.users.findByEmail(email);
    // Mesmo erro, e o mesmo tempo, pra "e-mail não existe", "conta só social" e "senha errada":
    // sem conta, gasta uma conferência de mentira (senão o tempo de resposta entrega quais e-mails têm conta).
    if (!user || !user.passwordHash) {
      await burnPasswordCheck(password);
      throw new InvalidCredentialsError();
    }
    if (!(await verifyPassword(password, user.passwordHash))) throw new InvalidCredentialsError();
    // Hash antigo (custo menor)? A senha acabou de ser conferida, então já refazemos com o custo atual.
    if (needsRehash(user.passwordHash)) {
      try {
        await this.users.updatePassword(user.id, await hashPassword(password));
      } catch {
        // Falhar o rehash não pode impedir o login: fica pro próximo.
      }
    }
    return { user };
  }
}
