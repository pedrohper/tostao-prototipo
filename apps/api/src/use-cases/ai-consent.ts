import type { Repositories, UsersRepository } from '../repositories/types.js';
import { AiConsentRequiredError, ResourceNotFoundError } from '../domain/errors.js';

/** LGPD: confere o aceite do aviso de IA. Lança 403 AI_CONSENT_REQUIRED se a pessoa ainda não aceitou. */
export async function requireAiConsent(users: Pick<UsersRepository, 'findById'>, userId: string) {
  const user = await users.findById(userId);
  if (!user) throw new ResourceNotFoundError('Conta');
  if (!user.aiConsentAt) throw new AiConsentRequiredError();
  return user;
}

/** Versão do texto do aviso de IA aceito (muda quando o aviso mudar). */
export const AI_CONSENT_VERSION = '2026-11-20';

/** Aceitar (true) registra a data; revogar (false) apaga: a IA volta a ficar bloqueada na hora. */
export class SetAiConsentUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'consents' | 'audit' | 'tx'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute({ userId, accepted }: { userId: string; accepted: boolean }) {
    const user = await this.repos.users.findById(userId);
    if (!user) throw new ResourceNotFoundError('Conta');
    // Aceitar de novo não renova a data do primeiro aceite (é a prova do consentimento).
    const at = accepted ? (user.aiConsentAt ?? this.now()) : null;
    // Estado atual (users.ai_consent_at), histórico (user_consents) e auditoria andam juntos.
    await this.repos.tx(async (r) => {
      await r.users.setAiConsent(userId, at);
      if (accepted && !user.aiConsentAt)
        await r.consents.grant({ userId, type: 'ai', version: AI_CONSENT_VERSION, at: at! });
      if (!accepted && user.aiConsentAt) await r.consents.revoke(userId, 'ai', this.now());
      if (accepted !== Boolean(user.aiConsentAt)) {
        await r.audit.record({
          userId,
          action: 'consent_changed',
          entityType: 'consent',
          entityId: 'ai',
          metadata: { accepted },
        });
      }
    });
    return { aiConsentAt: at };
  }
}
