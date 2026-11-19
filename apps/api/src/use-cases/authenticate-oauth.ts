import type { OAuthProvider } from '../domain/entities.js';
import { AppError } from '../domain/errors.js';
import type { OAuthGateway } from '../gateways/oauth-gateway.js';
import type { Repositories } from '../repositories/types.js';
import { normalizeInviteCode } from './invites.js';

type Input = {
  provider: OAuthProvider;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  expectedNonce: string;
  name?: string;
  inviteCode?: string | null;
};

function deriveName(explicitName: string | undefined, providerName: string | null, email: string): string {
  const cleanedExplicit = explicitName?.trim();
  if (cleanedExplicit && cleanedExplicit.length >= 2) return cleanedExplicit;
  const cleanedProvider = providerName?.trim();
  if (cleanedProvider && cleanedProvider.length >= 2) return cleanedProvider;
  const local = email
    .split('@')[0]
    ?.replace(/[._-]+/g, ' ')
    .trim();
  if (local && local.length >= 2) {
    return local.replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
  }
  return 'Usuário';
}

/**
 * Login / cadastro com Google ou Apple.
 * 1. Troca o code pelo id_token verificado no provedor.
 * 2. Se (provider, sub) já existe -> entra direto.
 * 3. Se o e-mail verificado já tem conta -> vincula o provedor e entra.
 * 4. Senão -> cria conta sem senha (passwordHash = null), vincula o provedor e aplica convite/amigo opcional.
 */
export class AuthenticateOAuthUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'oauthAccounts' | 'invites' | 'engagement'>,
    private readonly oauth: OAuthGateway,
  ) {}

  async execute(input: Input) {
    const identity = await this.oauth.exchangeCode({
      provider: input.provider,
      code: input.code,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier,
      expectedNonce: input.expectedNonce,
    });

    const email = identity.email.trim().toLowerCase();
    const existingLink = await this.repos.oauthAccounts.findByProviderAccount(
      identity.provider,
      identity.providerAccountId,
    );
    if (existingLink) {
      const user = await this.repos.users.findById(existingLink.userId);
      if (user) return { user, isNewUser: false };
    }

    const existingUser = await this.repos.users.findByEmail(email);
    if (existingUser) {
      if (!identity.emailVerified) {
        throw new AppError('Seu e-mail precisa estar verificado no provedor pra entrar nesta conta.', 403);
      }
      await this.repos.oauthAccounts.create({
        userId: existingUser.id,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
        email,
      });
      return { user: existingUser, isNewUser: false };
    }

    if (!identity.emailVerified) {
      throw new AppError('Seu e-mail precisa estar verificado no provedor pra criar conta.', 403);
    }

    const name = deriveName(input.name, identity.name, email);
    const user = await this.repos.users.create({ name, email, passwordHash: null });
    await this.repos.oauthAccounts.create({
      userId: user.id,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      email,
    });

    const code = input.inviteCode ? normalizeInviteCode(input.inviteCode) : '';
    if (code) {
      const invite = await this.repos.invites.findByCode(code);
      if (invite && !invite.usedById) {
        await this.repos.invites.markUsed(code, user.id);
        await this.repos.engagement.addFriend(invite.createdById, user.id);
      } else {
        const friendId = await this.repos.engagement.findUserByFriendCode(code);
        if (friendId) await this.repos.engagement.addFriend(friendId, user.id);
      }
    }

    return { user, isNewUser: true };
  }
}
