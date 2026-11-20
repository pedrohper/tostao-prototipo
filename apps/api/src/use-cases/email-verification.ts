import type { EmailGateway } from '../gateways/email-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { InvalidVerificationTokenError } from '../domain/errors.js';
import { hashToken, newOpaqueToken } from './sessions.js';

export const EMAIL_VERIFICATION_TTL_HOURS = 24;

/** Envio em segundo plano: a resposta HTTP não espera o provedor de e-mail nem revela o que aconteceu com ele. */
export class BackgroundTasks {
  private readonly pending = new Set<Promise<void>>();
  constructor(
    private readonly onError: (err: unknown) => void = (e) => console.error('[email] falhou:', (e as Error).name),
  ) {}

  run(task: () => Promise<void>) {
    const p = task()
      .catch((err) => this.onError(err))
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
  }
  /** Espera os envios em andamento (testes, scripts e desligamento). */
  async drain() {
    while (this.pending.size) await Promise.all([...this.pending]);
  }
}

export function joinUrl(base: string, path: string) {
  const origin = /^https?:\/\//.test(base) ? base.replace(/\/+$/, '') : 'http://localhost:3000';
  return `${origin}${path}`;
}

/** Gera o link (256 bits, 24 h, só o hash vai pro banco) e manda por e-mail. Um link novo invalida os anteriores. */
export class SendEmailVerificationUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'emailVerifications'>,
    private readonly email: EmailGateway,
    private readonly appUrl: string,
    readonly tasks = new BackgroundTasks(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Retorna false se não há o que enviar (conta inexistente ou e-mail já verificado). */
  async execute({ userId }: { userId: string }): Promise<boolean> {
    const user = await this.repos.users.findById(userId);
    if (!user || user.emailVerifiedAt) return false;
    const token = newOpaqueToken();
    const now = this.now();
    await this.repos.emailVerifications.replacePending(
      {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_HOURS * 3600_000),
      },
      now,
    );
    const verifyUrl = joinUrl(this.appUrl, `/verificar-email?token=${token}`);
    this.tasks.run(() =>
      this.email.sendEmailVerification({
        to: user.email,
        name: user.name,
        verifyUrl,
        expiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
      }),
    );
    return true;
  }
}

export class VerifyEmailUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'emailVerifications'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ token }: { token: string }) {
    const done = await this.repos.emailVerifications.consume({ tokenHash: hashToken(token), now: this.now() });
    if (!done) throw new InvalidVerificationTokenError();
    return { userId: done.userId };
  }
}
