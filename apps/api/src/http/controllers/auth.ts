import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  loginBody,
  oauthCallbackBody,
  oauthStartBody,
  passwordResetRequestBody,
  PASSWORD_RESET_REQUEST_MESSAGE,
  refreshBody,
  registerBody,
  resetPasswordBody,
  verifyEmailBody,
  type PasswordResetRequestResponse,
  type AuthResponse,
  type InvitesResponse,
  type OAuthAuthResponse,
  type OAuthProvider,
  type OAuthProvidersResponse,
  type OAuthStartResponse,
  type ProfileResponse,
} from '@tostao/contracts';
import { AppError } from '../../domain/errors.js';
import { DisabledOAuthGateway, type OAuthGateway } from '../../gateways/oauth-gateway.js';
import type { Limiters } from '../rate-limits.js';
import { OAuthStateStore } from '../../services/oauth-state.js';
import { testOnlyKeyValueStore } from '../../lib/redis.js';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

/**
 * A redirect_uri tem que ser exatamente a nossa rota de callback. Em produção: HTTPS e a origem de WEB_ORIGIN, sem exceção.
 * localhost/127.0.0.1 só passam em development/test (qualquer outro NODE_ENV, inclusive vazio, conta como produção).
 */
export function assertAllowedRedirectUri(redirectUri: string, provider: OAuthProvider, webOrigin: string) {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new AppError('URL de retorno inválida.', 400);
  }
  if (parsed.pathname !== `/api/auth/${provider}/callback` || parsed.search || parsed.hash || parsed.username) {
    throw new AppError('URL de retorno não permitida.', 400);
  }
  const devLike = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (devLike && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) return;
  let allowed: URL;
  try {
    allowed = new URL(webOrigin); // "*" não é URL: nunca libera nada
  } catch {
    throw new AppError('Origem de retorno não autorizada.', 400);
  }
  if (!devLike && parsed.protocol !== 'https:') throw new AppError('Origem de retorno não autorizada.', 400);
  if (parsed.origin !== allowed.origin) throw new AppError('Origem de retorno não autorizada.', 400);
}

export function authRoutes(
  app: FastifyInstance,
  uc: UseCases,
  limits: Limiters,
  oauth: OAuthGateway = new DisabledOAuthGateway(),
  webOrigin = '*',
  oauthState: OAuthStateStore = new OAuthStateStore(testOnlyKeyValueStore()),
) {
  /** Abre uma sessão nova (família de refresh tokens) e assina o access token de 15 min. */
  async function startSession(request: FastifyRequest, reply: FastifyReply, userId: string): Promise<AuthResponse> {
    const { refreshToken } = await uc.sessions.open(userId, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
    const accessToken = await reply.jwtSign({}, { sign: { sub: userId } });
    return { accessToken, refreshToken };
  }

  app.post('/users', { preHandler: limits.usersByIp }, async (request, reply) => {
    const body = registerBody.parse(request.body);
    const { user } = await uc.registerUser.execute(body);
    return reply.status(201).send(await startSession(request, reply, user.id));
  });

  // Login: 10 por 15 min por IP + e-mail (quem erra a própria senha) e 30 por 15 min por IP (quem testa vários e-mails).
  // O limite NÃO é só por e-mail: senão qualquer um travaria o login da vítima de propósito.
  app.post('/sessions', { preHandler: [limits.sessionsByIpEmail, limits.sessionsByIp] }, async (request, reply) => {
    const body = loginBody.parse(request.body);
    const { user } = await uc.authenticate.execute(body);
    return reply.send(await startSession(request, reply, user.id));
  });

  // Login social (Google e Apple): a web coordena cookie de state/PKCE e delega o protocolo OIDC pra API.
  app.get('/auth/oauth/providers', async () => oauth.enabledProviders() satisfies OAuthProvidersResponse);

  app.post('/auth/oauth/start', async (request, reply) => {
    const body = oauthStartBody.parse(request.body);
    assertAllowedRedirectUri(body.redirectUri, body.provider, webOrigin);
    if (!oauth.isEnabled(body.provider)) {
      throw new AppError(
        `Login com ${body.provider === 'google' ? 'Google' : 'Apple'} ainda não está ativado neste servidor.`,
        503,
      );
    }
    const { state, nonce, codeChallenge } = await oauthState.begin(body);
    const url = oauth.buildAuthorizeUrl({
      provider: body.provider,
      redirectUri: body.redirectUri,
      state,
      nonce,
      codeChallenge,
    });
    return reply.send({ url, state } satisfies OAuthStartResponse);
  });

  app.post('/auth/oauth/callback', async (request, reply) => {
    const body = oauthCallbackBody.parse(request.body);
    assertAllowedRedirectUri(body.redirectUri, body.provider, webOrigin);
    // Uso único: o state é apagado ao ler. Replay, state forjado ou expirado caem aqui.
    const saved = await oauthState.consume(body.state);
    if (!saved || saved.provider !== body.provider || saved.redirectUri !== body.redirectUri) {
      throw new AppError('Sessão de login expirou. Tenta de novo.', 400);
    }
    const { user, isNewUser } = await uc.authenticateOAuth.execute({
      provider: saved.provider,
      code: body.code,
      redirectUri: saved.redirectUri,
      codeVerifier: saved.codeVerifier,
      expectedNonce: saved.nonce,
      name: body.name,
      inviteCode: saved.inviteCode,
    });
    return reply.send({ ...(await startSession(request, reply, user.id)), isNewUser } satisfies OAuthAuthResponse);
  });

  // Renovação: troca o refresh token por um par novo. Não exige o access token (ele já pode ter vencido).
  // Token reusado (já trocado) derruba a família inteira: quem tinha uma cópia perde o acesso.
  app.post('/sessions/refresh', async (request, reply) => {
    const { refreshToken } = refreshBody.parse(request.body);
    const rotated = await uc.sessions.rotate(refreshToken, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });
    const accessToken = await reply.jwtSign({}, { sign: { sub: rotated.userId } });
    return reply.send({ accessToken, refreshToken: rotated.refreshToken } satisfies AuthResponse);
  });

  // Sair deste aparelho. Idempotente: sempre 204 (não revela se o token existia).
  app.post('/sessions/logout', async (request, reply) => {
    const { refreshToken } = refreshBody.parse(request.body);
    await uc.sessions.logout(refreshToken);
    return reply.status(204).send();
  });

  // Sair de todos os aparelhos.
  app.post('/sessions/logout-all', { onRequest: verifyJwt }, async (request, reply) => {
    await uc.sessions.logoutAll(request.user.sub);
    return reply.status(204).send();
  });

  // "Esqueci minha senha": resposta SEMPRE igual (202), exista a conta ou não. O limite é por e-mail
  // (não por IP: a API fica atrás do Next, todo pedido vem do mesmo IP) e vale também pra e-mail sem conta.
  app.post(
    '/password-resets',
    { preHandler: [limits.passwordResetsByIp, limits.passwordResetsByEmail] },
    async (request, reply) => {
      const { email } = passwordResetRequestBody.parse(request.body);
      await uc.requestPasswordReset.execute({ email });
      return reply.status(202).send({ message: PASSWORD_RESET_REQUEST_MESSAGE } satisfies PasswordResetRequestResponse);
    },
  );

  // Link recebido por e-mail (ver /password-resets). Troca a senha, derruba as outras sessões e já entra.
  app.post('/password-resets/redeem', { preHandler: limits.passwordRedeemByIp }, async (request, reply) => {
    const body = resetPasswordBody.parse(request.body);
    const { userId } = await uc.resetPassword.execute(body);
    return reply.send(await startSession(request, reply, userId));
  });

  // Confirma o e-mail do cadastro com o link (uso único, 24 h).
  app.post('/auth/verify-email', async (request, reply) => {
    const body = verifyEmailBody.parse(request.body);
    await uc.verifyEmail.execute(body);
    return reply.send({ verified: true });
  });

  // Reenvia o link de verificação pra quem está logado. 202 igual com ou sem envio (já verificado não envia).
  app.post(
    '/auth/resend-verification',
    { onRequest: verifyJwt, preHandler: [limits.resendVerificationByIp, limits.resendVerificationByUser] },
    async (request, reply) => {
      await uc.sendEmailVerification.execute({ userId: request.user.sub });
      return reply.status(202).send({ message: 'Se ainda falta confirmar, o link novo está a caminho.' });
    },
  );

  app.get('/invites', { onRequest: verifyJwt }, async (request) => {
    const { invites } = await uc.listInvites.execute({ userId: request.user.sub });
    return {
      invites: invites.map((i) => ({
        code: i.code,
        createdAt: i.createdAt.toISOString(),
        usedAt: i.usedAt?.toISOString() ?? null,
        usedBy: i.usedBy,
      })),
    } satisfies InvitesResponse;
  });

  app.post('/invites', { onRequest: verifyJwt }, async (request, reply) => {
    const { invite } = await uc.createInvite.execute({ userId: request.user.sub });
    return reply.status(201).send({ code: invite.code });
  });

  app.get('/me', { onRequest: verifyJwt }, async (request) => {
    const { user, providers, connections, pluggyEnabled } = await uc.getProfile.execute({
      userId: request.user.sub,
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      hasPassword: Boolean(user.passwordHash),
      pluggyEnabled,
      providers,
      createdAt: user.createdAt.toISOString(),
      aiConsentAt: user.aiConsentAt?.toISOString() ?? null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      connections: connections.map((c) => ({
        id: c.id,
        isImport: c.itemId.startsWith('import:'),
        isManual: c.itemId.startsWith('manual:'),
        institution: c.institution,
        displayName: c.displayName,
        status: c.status,
        lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
        accounts: c.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          balanceInCents: a.balanceInCents,
          hidden: a.hidden,
        })),
      })),
    } satisfies ProfileResponse;
  });
}
