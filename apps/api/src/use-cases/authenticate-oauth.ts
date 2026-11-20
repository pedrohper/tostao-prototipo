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
 * 3. Se o e-mail já tem conta -> só vincula se o e-mail da conta JÁ era verificado ou se ela é só social.
 *    Conta de senha com e-mail não verificado NÃO é vinculada: senão quem cadastrasse "vitima@gmail.com" antes
 *    da vítima continuaria com a senha dele na conta que o Google da vítima acabou de abrir (pre-account takeover).
 * 4. Senão -> cria conta sem senha (passwordHash = null) já com e-mail verificado, vincula e aplica convite/amigo.
 */
export class AuthenticateOAuthUseCase {
  constructor(
    private readonly repos: Pick<Repositories, 'users' | 'oauthAccounts' | 'invites' | 'engagement' | 'tx'>,
    private readonly oauth: OAuthGateway,
    private readonly now: () => Date = () => new Date(),
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
      const proven = existingUser.emailVerifiedAt !== null || existingUser.passwordHash === null;
      if (!proven) {
        throw new AppError('Esse e-mail já tem uma conta com senha. Entra com e-mail e senha.', 409);
      }
      // Conta só social que ainda não tinha a marca: o provedor acabou de confirmar o e-mail. Marca + vínculo juntos.
      await this.repos.tx(async (r) => {
        await r.users.markEmailVerified(existingUser.id, this.now());
        await r.oauthAccounts.create({
          userId: existingUser.id,
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
          email,
        });
      });
      return { user: existingUser, isNewUser: false };
    }

    if (!identity.emailVerified) {
      throw new AppError('Seu e-mail precisa estar verificado no provedor pra criar conta.', 403);
    }

    const name = deriveName(input.name, identity.name, email);
    const code = input.inviteCode ? normalizeInviteCode(input.inviteCode) : '';
    // Conta + vínculo social + convite + amizade: tudo ou nada.
    const user = await this.repos.tx(async (r) => {
      const created = await r.users.create({ name, email, passwordHash: null, emailVerifiedAt: this.now() });
      await r.oauthAccounts.create({
        userId: created.id,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
        email,
      });
      if (code) {
        const invite = await r.invites.findByCode(code);
        const claimed = invite && !invite.usedAt && !invite.usedById && (await r.invites.markUsed(code, created.id));
        if (claimed) {
          if (invite.createdById) await r.engagement.addFriend(invite.createdById, created.id);
        } else {
          const friendId = await r.engagement.findUserByFriendCode(code);
          if (friendId) await r.engagement.addFriend(friendId, created.id);
        }
      }
      return created;
    });

    return { user, isNewUser: true };
  }
}
