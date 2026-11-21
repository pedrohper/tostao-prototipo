import type { EmailGateway } from '../gateways/email-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { AppError } from '../domain/errors.js';
import { hashPassword } from '../lib/password.js';
import { BackgroundTasks, joinUrl } from './email-verification.js';
import { hashToken, newOpaqueToken } from './sessions.js';

const ONE_HOUR = 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MINUTES = 60;

export class InvalidResetTokenError extends AppError {
  constructor() {
    super('Esse link expirou ou já foi usado. Pede um novo.', 400);
  }
}

/**
 * "Esqueci minha senha". Não revela se o e-mail tem conta: com conta ou sem, retorna igual e na mesma hora
 * (o envio do e-mail roda em segundo plano, então o tempo da resposta não entrega nada).
 * Só o hash do token (256 bits, 1 h) vai pro banco; um pedido novo invalida os links anteriores.
 */
export class RequestPasswordResetUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'passwordResets'>,
    private readonly email: EmailGateway,
    private readonly appUrl: string,
    readonly tasks = new BackgroundTasks(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ email }: { email: string }): Promise<void> {
    const user = await this.repos.users.findByEmail(email.trim().toLowerCase());
    if (!user) return;
    const token = newOpaqueToken();
    const now = this.now();
    await this.repos.passwordResets.replacePending(
      { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + ONE_HOUR) },
      now,
    );
    const resetUrl = joinUrl(this.appUrl, `/redefinir-senha?token=${token}`);
    this.tasks.run(() =>
      this.email.sendPasswordReset({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      }),
    );
  }
}

export class ResetPasswordUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'passwordResets' | 'audit'>,
    private readonly email?: EmailGateway,
    private readonly tasks = new BackgroundTasks(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ token, password }: { token: string; password: string }) {
    const tokenHash = hashToken(token);
    // Checagem barata antes do bcrypt (não gasta ~250 ms de CPU com link inventado). Quem decide de verdade é o redeem.
    const reset = await this.repos.passwordResets.findByTokenHash(tokenHash);
    if (!reset || reset.usedAt || reset.expiresAt <= this.now()) throw new InvalidResetTokenError();

    const passwordHash = await hashPassword(password);
    // Atômico: dois resgates do mesmo link ao mesmo tempo, só um passa. Também revoga todas as sessões.
    const redeemed = await this.repos.passwordResets.redeem({ tokenHash, passwordHash, now: this.now() });
    if (!redeemed) throw new InvalidResetTokenError();
    await this.repos.audit.record({
      userId: redeemed.userId,
      action: 'password_reset',
      entityType: 'user',
      entityId: redeemed.userId,
    });

    const email = this.email;
    if (email) {
      const user = await this.repos.users.findById(redeemed.userId);
      if (user) {
        this.tasks.run(() =>
          email.sendSecurityAlert({ to: user.email, name: user.name, event: 'password_changed', at: this.now() }),
        );
      }
    }
    return { userId: redeemed.userId };
  }
}
