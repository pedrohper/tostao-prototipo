import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { REFRESH_TOKEN_TTL_SECONDS } from '@tostao/contracts';
import type { Repositories } from '../repositories/types.js';
import { InvalidRefreshTokenError } from '../domain/errors.js';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
/** Token opaco de 256 bits. Só o SHA-256 vai pro banco: quem lê a tabela não consegue usar as sessões. */
export const newOpaqueToken = () => randomBytes(32).toString('base64url');

/**
 * Janela de tolerância do reuso. Dentro dela, um refresh token já trocado cujo filho ainda não foi usado NÃO derruba a
 * família: ganha outro token. Cobre a aba que perdeu a resposta da troca e duas abas renovando ao mesmo tempo.
 * Passou disso, vale o comportamento de sempre (reuso = roubo/replay: revoga a família e grava `refresh_reuse_detected`).
 */
export const REFRESH_REUSE_GRACE_SECONDS = 30;

export type SessionContext = { userAgent?: string | null; ipAddress?: string | null };
const clip = (v: string | null | undefined, max: number) => (v ? v.slice(0, max) : null);

/**
 * Sessão revogável. O access token (JWT de 15 min) é assinado no controller; aqui vive só o refresh token:
 * criar (login), rotacionar (cada renovação troca o token), detectar reuso (derruba a família) e revogar.
 */
export class SessionsUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'refreshTokens' | 'audit'>,
    private readonly now: () => Date = () => new Date(),
    private readonly ttlSeconds = REFRESH_TOKEN_TTL_SECONDS,
    private readonly graceSeconds = REFRESH_REUSE_GRACE_SECONDS,
  ) {}

  private expiry() {
    return new Date(this.now().getTime() + this.ttlSeconds * 1000);
  }

  /** Login/cadastro/OAuth: abre uma família nova (um aparelho/navegador). */
  async open(userId: string, ctx: SessionContext = {}): Promise<{ refreshToken: string }> {
    const refreshToken = newOpaqueToken();
    await this.repos.refreshTokens.create({
      userId,
      tokenHash: hashToken(refreshToken),
      familyId: randomUUID(),
      expiresAt: this.expiry(),
      userAgent: clip(ctx.userAgent, 255),
      ipAddress: clip(ctx.ipAddress, 64),
    });
    return { refreshToken };
  }

  /**
   * Troca o refresh token por um novo. Reuso de token já trocado revoga a família inteira e responde 401, a não ser
   * dentro da janela de tolerância (ver `REFRESH_REUSE_GRACE_SECONDS`).
   */
  async rotate(refreshToken: string, ctx: SessionContext = {}): Promise<{ userId: string; refreshToken: string }> {
    const next = newOpaqueToken();
    const result = await this.repos.refreshTokens.rotate({
      tokenHash: hashToken(refreshToken),
      now: this.now(),
      graceMs: this.graceSeconds * 1000,
      next: {
        tokenHash: hashToken(next),
        expiresAt: this.expiry(),
        userAgent: clip(ctx.userAgent, 255),
        ipAddress: clip(ctx.ipAddress, 64),
      },
    });
    if (result.status === 'reused') {
      // Token já trocado reapresentado: a família foi revogada. Fica registrado (sem o token).
      await this.repos.audit.record({
        userId: result.userId,
        action: 'refresh_reuse_detected',
        entityType: 'refresh_token_family',
        entityId: result.familyId,
        ipAddress: ctx.ipAddress ?? null,
      });
    }
    if (result.status === 'rotated' && result.viaGrace) {
      // Não é reuso: fica só o registro (sem o token) pra dar pra medir quantas vezes a janela salvou uma sessão.
      await this.repos.audit.record({
        userId: result.userId,
        action: 'refresh_grace_used',
        entityType: 'refresh_token_family',
        entityId: result.familyId,
        ipAddress: ctx.ipAddress ?? null,
      });
    }
    if (result.status !== 'rotated') throw new InvalidRefreshTokenError();
    return { userId: result.userId, refreshToken: next };
  }

  /** Sair deste aparelho. Idempotente: token desconhecido ou já revogado não é erro. */
  async logout(refreshToken: string): Promise<void> {
    await this.repos.refreshTokens.revokeFamilyOf(hashToken(refreshToken), this.now());
  }

  /** Sair de todos os aparelhos. */
  async logoutAll(userId: string): Promise<void> {
    await this.repos.refreshTokens.revokeAllForUser(userId, this.now());
  }
}
