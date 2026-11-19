import type { FastifyInstance } from 'fastify';
import {
  loginBody,
  oauthCallbackBody,
  oauthStartBody,
  registerBody,
  resetPasswordBody,
  type AuthResponse,
  type InvitesResponse,
  type OAuthAuthResponse,
  type OAuthProvider,
  type OAuthProvidersResponse,
  type OAuthStartResponse,
  type ProfileResponse,
} from '@tostao/contracts';
import { AppError, InvalidCredentialsError } from '../../domain/errors.js';
import { DisabledOAuthGateway, type OAuthGateway } from '../../gateways/oauth-gateway.js';
import { LoginLimiter } from '../login-limiter.js';
import type { UseCases } from '../../use-cases/factories.js';
import { verifyJwt } from '../middlewares/verify-jwt.js';

function assertAllowedRedirectUri(redirectUri: string, provider: OAuthProvider, webOrigin: string) {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new AppError('URL de retorno inválida.', 400);
  }
  if (parsed.pathname !== `/api/auth/${provider}/callback`) {
    throw new AppError('URL de retorno não permitida.', 400);
  }
  if (webOrigin === '*') return;
  const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (isLocal) return;
  try {
    const allowedOrigin = new URL(webOrigin).origin;
    if (parsed.origin === allowedOrigin) return;
  } catch {
    // webOrigin inválido — cai no erro abaixo
  }
  throw new AppError('Origem de retorno não autorizada.', 400);
}

export function authRoutes(
  app: FastifyInstance,
  uc: UseCases,
  limiter = new LoginLimiter(),
  oauth: OAuthGateway = new DisabledOAuthGateway(),
  webOrigin = '*',
) {
  app.post('/users', async (request, reply) => {
    const body = registerBody.parse(request.body);
    const { user } = await uc.registerUser.execute(body);
    const token = await reply.jwtSign({}, { sign: { sub: user.id } });
    return reply.status(201).send({ token } satisfies AuthResponse);
  });

  app.post('/sessions', async (request, reply) => {
    const body = loginBody.parse(request.body);
    const wait = limiter.blockedFor(body.email);
    if (wait) throw new AppError(`Muitas tentativas. Espera ${wait} min e tenta de novo.`, 429);
    let user;
    try {
      ({ user } = await uc.authenticate.execute(body));
    } catch (e) {
      if (e instanceof InvalidCredentialsError) limiter.fail(body.email);
      throw e;
    }
    limiter.reset(body.email);
    const token = await reply.jwtSign({}, { sign: { sub: user.id } });
    return reply.send({ token } satisfies AuthResponse);
  });

  // Login social (Google e Apple): a web coordena cookie de state/PKCE e delega o protocolo OIDC pra API.
  app.get('/auth/oauth/providers', async () => oauth.enabledProviders() satisfies OAuthProvidersResponse);

  app.post('/auth/oauth/start', async (request, reply) => {
    const body = oauthStartBody.parse(request.body);
    assertAllowedRedirectUri(body.redirectUri, body.provider, webOrigin);
    const url = oauth.buildAuthorizeUrl(body);
    return reply.send({ url } satisfies OAuthStartResponse);
  });

  app.post('/auth/oauth/callback', async (request, reply) => {
    const body = oauthCallbackBody.parse(request.body);
    assertAllowedRedirectUri(body.redirectUri, body.provider, webOrigin);
    const { user, isNewUser } = await uc.authenticateOAuth.execute(body);
    const token = await reply.jwtSign({}, { sign: { sub: user.id } });
    return reply.send({ token, isNewUser } satisfies OAuthAuthResponse);
  });

  // Sessão que renova sozinha: a web troca o token quando ele passa de 1 dia.
  app.post('/sessions/refresh', { onRequest: verifyJwt }, async (request, reply) => {
    const token = await reply.jwtSign({}, { sign: { sub: request.user.sub } });
    return reply.send({ token } satisfies AuthResponse);
  });

  // Link de "esqueci a senha" (gerado no servidor com pnpm reset-link)
  app.post('/password-resets/redeem', async (request, reply) => {
    const body = resetPasswordBody.parse(request.body);
    const { userId } = await uc.resetPassword.execute(body);
    const token = await reply.jwtSign({}, { sign: { sub: userId } });
    return reply.send({ token } satisfies AuthResponse);
  });

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
    const { user, providers, connections } = await uc.getProfile.execute({ userId: request.user.sub });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      hasPassword: Boolean(user.passwordHash),
      providers,
      createdAt: user.createdAt.toISOString(),
      connections: connections.map((c) => ({
        id: c.id,
        itemId: c.itemId,
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
