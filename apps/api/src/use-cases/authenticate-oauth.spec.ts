import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import type {
  OAuthAuthorizeInput,
  OAuthExchangeInput,
  OAuthGateway,
  OAuthIdentity,
} from '../gateways/oauth-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import type { OAuthProvider } from '../domain/entities.js';

class FakeOAuthGateway implements OAuthGateway {
  constructor(private readonly identities: Record<string, OAuthIdentity>) {}
  isEnabled(): boolean {
    return true;
  }
  enabledProviders() {
    return { google: true, apple: true };
  }
  buildAuthorizeUrl({ provider, state }: OAuthAuthorizeInput): string {
    return `https://provider.test/${provider}?state=${state}`;
  }
  async exchangeCode({ code }: OAuthExchangeInput): Promise<OAuthIdentity> {
    const id = this.identities[code];
    if (!id) throw new Error(`unexpected code ${code}`);
    return id;
  }
}

describe('Login social (Google e Apple)', () => {
  it('cria conta via Google, vincula convite, reaproveita conta ao voltar e permite apagar confirmando e-mail', async () => {
    const repos = makeInMemoryRepositories();
    const oauth = new FakeOAuthGateway({
      'code-ana': {
        provider: 'google',
        providerAccountId: 'sub-ana-1',
        email: 'ana@gmail.com',
        emailVerified: true,
        name: 'Ana Paula',
      },
      'code-unverified': {
        provider: 'google',
        providerAccountId: 'sub-bad',
        email: 'nao@gmail.com',
        emailVerified: false,
        name: 'Sem Verif',
      },
    });
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      oauth,
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: 'https://tostao.test',
    });

    const providers = await app.inject({ method: 'GET', url: '/auth/oauth/providers' });
    expect(providers.json()).toEqual({ google: true, apple: true });

    // Rejeita redirectUri de origem estrangeira
    const badStart = await app.inject({
      method: 'POST',
      url: '/auth/oauth/start',
      payload: {
        provider: 'google',
        redirectUri: 'https://evil.test/api/auth/google/callback',
        state: 's'.repeat(32),
        nonce: 'n'.repeat(32),
      },
    });
    expect(badStart.statusCode).toBe(400);

    // Aceita origem configurada
    const okStart = await app.inject({
      method: 'POST',
      url: '/auth/oauth/start',
      payload: {
        provider: 'google',
        redirectUri: 'https://tostao.test/api/auth/google/callback',
        state: 's'.repeat(32),
        nonce: 'n'.repeat(32),
      },
    });
    expect(okStart.statusCode).toBe(200);
    expect(okStart.json().url).toContain('https://provider.test/google');

    // Cria usuário convidador para testar convite no signup social
    const donoReg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'pedro@x.com', password: '12345678' },
    });
    const donoAuth = { authorization: `Bearer ${donoReg.json().token}` };
    const { code: inviteCode } = (await app.inject({ method: 'POST', url: '/invites', headers: donoAuth })).json();

    // E-mail não verificado é barrado
    const badEmail = await app.inject({
      method: 'POST',
      url: '/auth/oauth/callback',
      payload: {
        provider: 'google',
        code: 'code-unverified',
        redirectUri: 'https://tostao.test/api/auth/google/callback',
        expectedNonce: 'n'.repeat(32),
      },
    });
    expect(badEmail.statusCode).toBe(403);

    // Primeiro login com Google -> cria conta nova e usa o convite
    const first = await app.inject({
      method: 'POST',
      url: '/auth/oauth/callback',
      payload: {
        provider: 'google',
        code: 'code-ana',
        redirectUri: 'https://tostao.test/api/auth/google/callback',
        expectedNonce: 'n'.repeat(32),
        inviteCode,
      },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().isNewUser).toBe(true);
    const anaAuth = { authorization: `Bearer ${first.json().token}` };
    expect(repos.invites.items[0]!.usedById).toBeTruthy();

    // /me informa hasPassword: false e providers: ['google']
    const me = (await app.inject({ method: 'GET', url: '/me', headers: anaAuth })).json();
    expect(me).toMatchObject({
      name: 'Ana Paula',
      email: 'ana@gmail.com',
      hasPassword: false,
      providers: ['google'],
    });

    // Conta só social não entra com senha
    const pwdLogin = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { email: 'ana@gmail.com', password: 'qualquer-senha' },
    });
    expect(pwdLogin.statusCode).toBe(401);

    // Segundo login com Google -> não cria outra conta
    const second = await app.inject({
      method: 'POST',
      url: '/auth/oauth/callback',
      payload: {
        provider: 'google',
        code: 'code-ana',
        redirectUri: 'https://tostao.test/api/auth/google/callback',
        expectedNonce: 'n'.repeat(32),
      },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().isNewUser).toBe(false);
    expect(await repos.users.count()).toBe(2);

    // Apagar conta social: e-mail errado -> 403; e-mail certo -> 204
    const wrongDel = await app.inject({
      method: 'POST',
      url: '/me/delete',
      headers: anaAuth,
      payload: { confirmEmail: 'outro@gmail.com' },
    });
    expect(wrongDel.statusCode).toBe(403);

    const okDel = await app.inject({
      method: 'POST',
      url: '/me/delete',
      headers: anaAuth,
      payload: { confirmEmail: 'ANA@gmail.com' },
    });
    expect(okDel.statusCode).toBe(204);
    expect(await repos.users.count()).toBe(1);
    expect(repos.oauthAccounts.items).toHaveLength(0);
  });

  it('vincula Apple a uma conta existente de senha quando o e-mail é verificado e usa nome do form_post no primeiro cadastro', async () => {
    const repos = makeInMemoryRepositories();
    const oauth = new FakeOAuthGateway({
      'apple-existing': {
        provider: 'apple' satisfies OAuthProvider,
        providerAccountId: 'apple-sub-pedro',
        email: 'pedro@x.com',
        emailVerified: true,
        name: null,
      },
      'apple-new': {
        provider: 'apple' satisfies OAuthProvider,
        providerAccountId: 'apple-sub-maria',
        email: 'maria@icloud.com',
        emailVerified: true,
        name: null,
      },
    });
    const app = await buildApp({
      repos,
      bank: new FakeBankGateway(),
      oauth,
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });

    await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'pedro@x.com', password: '12345678' },
    });

    // Vincula à conta existente com senha
    const linked = await app.inject({
      method: 'POST',
      url: '/auth/oauth/callback',
      payload: {
        provider: 'apple',
        code: 'apple-existing',
        redirectUri: 'http://localhost:3000/api/auth/apple/callback',
        expectedNonce: 'n'.repeat(32),
      },
    });
    expect(linked.statusCode).toBe(200);
    expect(linked.json().isNewUser).toBe(false);
    const pedroMe = (
      await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${linked.json().token}` } })
    ).json();
    expect(pedroMe).toMatchObject({ email: 'pedro@x.com', hasPassword: true, providers: ['apple'] });

    // Primeiro cadastro via Apple recebe nome via form_post
    const maria = await app.inject({
      method: 'POST',
      url: '/auth/oauth/callback',
      payload: {
        provider: 'apple',
        code: 'apple-new',
        redirectUri: 'http://localhost:3000/api/auth/apple/callback',
        expectedNonce: 'n'.repeat(32),
        name: 'Maria Clara',
      },
    });
    expect(maria.statusCode).toBe(200);
    expect(maria.json().isNewUser).toBe(true);
    const mariaMe = (
      await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${maria.json().token}` } })
    ).json();
    expect(mariaMe).toMatchObject({
      name: 'Maria Clara',
      email: 'maria@icloud.com',
      hasPassword: false,
      providers: ['apple'],
    });
  });

  it('retorna 503 quando provedor não está configurado', async () => {
    const app = await buildApp({
      repos: makeInMemoryRepositories(),
      bank: new FakeBankGateway(),
      jwtSecret: 'segredo-de-teste-123',
      webOrigin: '*',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/oauth/start',
      payload: {
        provider: 'google',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        state: 's'.repeat(32),
        nonce: 'n'.repeat(32),
      },
    });
    expect(res.statusCode).toBe(503);
  });
});
