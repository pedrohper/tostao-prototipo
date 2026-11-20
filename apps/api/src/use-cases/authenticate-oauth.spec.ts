import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { FakeBankGateway } from '../gateways/fake-bank-gateway.js';
import type {
  OAuthAuthorizeInput,
  OAuthExchangeInput,
  OAuthGateway,
  OAuthIdentity,
} from '../gateways/oauth-gateway.js';
import { makeInMemoryRepositories } from '../repositories/in-memory/index.js';
import { MemoryKeyValueStore } from '../lib/redis.js';
import type { OAuthProvider } from '../domain/entities.js';

class FakeOAuthGateway implements OAuthGateway {
  authorizeCalls: OAuthAuthorizeInput[] = [];
  exchangeCalls: OAuthExchangeInput[] = [];
  constructor(
    private readonly identities: Record<string, OAuthIdentity>,
    private readonly enabled = true,
  ) {}
  isEnabled(): boolean {
    return this.enabled;
  }
  enabledProviders() {
    return { google: this.enabled, apple: this.enabled };
  }
  buildAuthorizeUrl(input: OAuthAuthorizeInput): string {
    this.authorizeCalls.push(input);
    return `https://provider.test/${input.provider}?state=${input.state}`;
  }
  async exchangeCode(input: OAuthExchangeInput): Promise<OAuthIdentity> {
    this.exchangeCalls.push(input);
    const id = this.identities[input.code];
    if (!id) throw new Error(`unexpected code ${input.code}`);
    return id;
  }
}

const GOOGLE_CB = 'https://tostao.test/api/auth/google/callback';
const APPLE_CB_LOCAL = 'http://localhost:3000/api/auth/apple/callback';

type App = Awaited<ReturnType<typeof buildApp>>;
/** Faz o /start como a web faz e devolve o state emitido pela API. */
async function start(app: App, provider: OAuthProvider, redirectUri: string, extra: Record<string, unknown> = {}) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/oauth/start',
    payload: { provider, redirectUri, ...extra },
  });
  expect(res.statusCode).toBe(200);
  return res.json().state as string;
}
const callback = (app: App, payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/auth/oauth/callback', payload });

const identity = (
  over: Partial<OAuthIdentity> & Pick<OAuthIdentity, 'providerAccountId' | 'email'>,
): OAuthIdentity => ({
  provider: 'google',
  emailVerified: true,
  name: null,
  ...over,
});

describe('Login social (Google e Apple)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('cria conta via Google, vincula convite, reaproveita conta ao voltar e permite apagar confirmando e-mail', async () => {
    const repos = makeInMemoryRepositories();
    const oauth = new FakeOAuthGateway({
      'code-ana': identity({ providerAccountId: 'sub-ana-1', email: 'ana@gmail.com', name: 'Ana Paula' }),
      'code-unverified': identity({ providerAccountId: 'sub-bad', email: 'nao@gmail.com', emailVerified: false }),
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
      payload: { provider: 'google', redirectUri: 'https://evil.test/api/auth/google/callback' },
    });
    expect(badStart.statusCode).toBe(400);

    // Aceita origem configurada; o state, o nonce e o PKCE nascem no servidor
    const okStart = await app.inject({
      method: 'POST',
      url: '/auth/oauth/start',
      payload: { provider: 'google', redirectUri: GOOGLE_CB },
    });
    expect(okStart.statusCode).toBe(200);
    expect(okStart.json().url).toContain('https://provider.test/google');
    expect(okStart.json().state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const issued = oauth.authorizeCalls.at(-1)!;
    expect(issued.state).toBe(okStart.json().state);
    expect(issued.nonce).toHaveLength(43);
    expect(issued.codeChallenge).toHaveLength(43); // Google: PKCE sempre

    // Cria usuário convidador para testar convite no signup social
    const donoReg = await app.inject({
      method: 'POST',
      url: '/users',
      payload: { name: 'Pedro', email: 'pedro@x.com', password: '12345678', acceptedTerms: true },
    });
    const donoAuth = { authorization: `Bearer ${donoReg.json().accessToken}` };
    const { code: inviteCode } = (await app.inject({ method: 'POST', url: '/invites', headers: donoAuth })).json();

    // E-mail não verificado no provedor é barrado
    const badEmail = await callback(app, {
      provider: 'google',
      code: 'code-unverified',
      redirectUri: GOOGLE_CB,
      state: await start(app, 'google', GOOGLE_CB),
    });
    expect(badEmail.statusCode).toBe(403);

    // Primeiro login com Google -> cria conta nova e usa o convite (guardado no servidor desde o /start)
    const first = await callback(app, {
      provider: 'google',
      code: 'code-ana',
      redirectUri: GOOGLE_CB,
      state: await start(app, 'google', GOOGLE_CB, { inviteCode }),
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().isNewUser).toBe(true);
    const anaAuth = { authorization: `Bearer ${first.json().accessToken}` };
    expect(repos.invites.items[0]!.usedById).toBeTruthy();
    // Conta social já nasce com e-mail verificado
    expect((await repos.users.findByEmail('ana@gmail.com'))!.emailVerifiedAt).toBeInstanceOf(Date);

    // /me informa hasPassword: false e providers: ['google']
    const me = (await app.inject({ method: 'GET', url: '/me', headers: anaAuth })).json();
    expect(me).toMatchObject({ name: 'Ana Paula', email: 'ana@gmail.com', hasPassword: false, providers: ['google'] });

    // Conta só social não entra com senha
    const pwdLogin = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: { email: 'ana@gmail.com', password: 'qualquer-senha' },
    });
    expect(pwdLogin.statusCode).toBe(401);

    // Segundo login com Google (novo state) -> não cria outra conta
    const second = await callback(app, {
      provider: 'google',
      code: 'code-ana',
      redirectUri: GOOGLE_CB,
      state: await start(app, 'google', GOOGLE_CB),
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().isNewUser).toBe(false);
    expect(await repos.users.count()).toBe(2);

    // Apagar conta social: e-mail errado -> 403; e-mail certo -> 200
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
    expect(okDel.statusCode).toBe(200);
    expect(await repos.users.count()).toBe(1);
    expect(repos.oauthAccounts.items).toHaveLength(0);
  });

  describe('pre-account takeover', () => {
    async function setup() {
      const repos = makeInMemoryRepositories();
      const oauth = new FakeOAuthGateway({
        'google-vitima': identity({ providerAccountId: 'sub-vitima', email: 'vitima@gmail.com', name: 'Vitima' }),
        'apple-pedro': identity({ provider: 'apple', providerAccountId: 'apple-sub-pedro', email: 'pedro@x.com' }),
        'apple-maria': identity({ provider: 'apple', providerAccountId: 'apple-sub-maria', email: 'maria@icloud.com' }),
      });
      const app = await buildApp({
        repos,
        bank: new FakeBankGateway(),
        oauth,
        jwtSecret: 'segredo-de-teste-123',
        webOrigin: '*',
      });
      return { repos, oauth, app };
    }

    it('atacante cadastra vitima@gmail.com sem verificar e a vítima entra com Google: NÃO vincula à conta do atacante', async () => {
      const { repos, app } = await setup();
      // atacante, com senha que só ele conhece
      const reg = await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'Atacante', email: 'vitima@gmail.com', password: 'senha-do-atacante', acceptedTerms: true },
      });
      expect(reg.statusCode).toBe(201);

      const res = await callback(app, {
        provider: 'google',
        code: 'google-vitima',
        redirectUri: 'http://localhost:3000/api/auth/google/callback',
        state: await start(app, 'google', 'http://localhost:3000/api/auth/google/callback'),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json()).not.toHaveProperty('token'); // a vítima não ganha sessão na conta do atacante
      expect(res.json().message).toMatch(/senha/i);
      expect(repos.oauthAccounts.items).toHaveLength(0); // nada foi vinculado
      expect(await repos.users.count()).toBe(1); // e nenhuma conta paralela foi criada

      // a conta continua do atacante, sem e-mail verificado
      expect((await repos.users.findByEmail('vitima@gmail.com'))!.emailVerifiedAt).toBeNull();
    });

    it('conta de senha com e-mail verificado vincula; conta só social vincula e fica marcada como verificada', async () => {
      const { repos, app } = await setup();
      await app.inject({
        method: 'POST',
        url: '/users',
        payload: { name: 'Pedro', email: 'pedro@x.com', password: '12345678', acceptedTerms: true },
      });
      const pedro = (await repos.users.findByEmail('pedro@x.com'))!;
      await repos.users.markEmailVerified(pedro.id, new Date());

      const linked = await callback(app, {
        provider: 'apple',
        code: 'apple-pedro',
        redirectUri: APPLE_CB_LOCAL,
        state: await start(app, 'apple', APPLE_CB_LOCAL),
      });
      expect(linked.statusCode).toBe(200);
      expect(linked.json().isNewUser).toBe(false);
      const pedroMe = (
        await app.inject({
          method: 'GET',
          url: '/me',
          headers: { authorization: `Bearer ${linked.json().accessToken}` },
        })
      ).json();
      expect(pedroMe).toMatchObject({ email: 'pedro@x.com', hasPassword: true, providers: ['apple'] });

      // conta social antiga sem a marca (criada antes da coluna existir): vincula e passa a verificada
      const social = await repos.users.create({ name: 'Maria', email: 'maria@icloud.com', passwordHash: null });
      expect(social.emailVerifiedAt).toBeNull();
      const maria = await callback(app, {
        provider: 'apple',
        code: 'apple-maria',
        redirectUri: APPLE_CB_LOCAL,
        state: await start(app, 'apple', APPLE_CB_LOCAL),
        name: 'Maria Clara',
      });
      expect(maria.statusCode).toBe(200);
      expect(maria.json().isNewUser).toBe(false);
      expect((await repos.users.findById(social.id))!.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('primeiro cadastro via Apple usa o nome do form_post', async () => {
      const { app } = await setup();
      const maria = await callback(app, {
        provider: 'apple',
        code: 'apple-maria',
        redirectUri: APPLE_CB_LOCAL,
        state: await start(app, 'apple', APPLE_CB_LOCAL),
        name: 'Maria Clara',
      });
      expect(maria.statusCode).toBe(200);
      expect(maria.json().isNewUser).toBe(true);
      const mariaMe = (
        await app.inject({
          method: 'GET',
          url: '/me',
          headers: { authorization: `Bearer ${maria.json().accessToken}` },
        })
      ).json();
      expect(mariaMe).toMatchObject({
        name: 'Maria Clara',
        email: 'maria@icloud.com',
        hasPassword: false,
        providers: ['apple'],
      });
    });
  });

  describe('state, nonce e PKCE no servidor', () => {
    async function setup(kv = new MemoryKeyValueStore()) {
      const repos = makeInMemoryRepositories();
      const oauth = new FakeOAuthGateway({
        'code-ana': identity({ providerAccountId: 'sub-ana-1', email: 'ana@gmail.com', name: 'Ana' }),
      });
      const app = await buildApp({
        repos,
        bank: new FakeBankGateway(),
        oauth,
        kv,
        jwtSecret: 'segredo-de-teste-123',
        webOrigin: 'https://tostao.test',
      });
      return { repos, oauth, app };
    }

    it('replay do mesmo state falha (uso único)', async () => {
      const { app } = await setup();
      const state = await start(app, 'google', GOOGLE_CB);
      const body = { provider: 'google', code: 'code-ana', redirectUri: GOOGLE_CB, state };
      expect((await callback(app, body)).statusCode).toBe(200);
      const replay = await callback(app, body);
      expect(replay.statusCode).toBe(400);
      expect(replay.json()).not.toHaveProperty('token');
    });

    it('state forjado, de outro formato ou nunca emitido falha', async () => {
      const { app, oauth } = await setup();
      for (const state of ['A'.repeat(43), 'curto', `${'A'.repeat(42)}!`]) {
        const res = await callback(app, { provider: 'google', code: 'code-ana', redirectUri: GOOGLE_CB, state });
        expect(res.statusCode, state).toBe(400);
      }
      expect(oauth.exchangeCalls).toHaveLength(0); // nem chegou a falar com o provedor
    });

    it('state expirado (5 min) falha', async () => {
      let now = 1_000_000;
      const { app, oauth } = await setup(new MemoryKeyValueStore(() => now));
      const state = await start(app, 'google', GOOGLE_CB);
      now += 5 * 60 * 1000 + 1;
      const res = await callback(app, { provider: 'google', code: 'code-ana', redirectUri: GOOGLE_CB, state });
      expect(res.statusCode).toBe(400);
      expect(oauth.exchangeCalls).toHaveLength(0);
    });

    it('state de um provedor não vale pro outro, e redirectUri diferente do /start falha', async () => {
      const { app, oauth } = await setup();
      const state = await start(app, 'google', GOOGLE_CB);
      const wrongProvider = await callback(app, {
        provider: 'apple',
        code: 'code-ana',
        redirectUri: 'https://tostao.test/api/auth/apple/callback',
        state,
      });
      expect(wrongProvider.statusCode).toBe(400);

      // com o state já queimado acima, emite outro e troca só o redirectUri (mesma origem, outro provedor)
      const state2 = await start(app, 'google', GOOGLE_CB);
      const wrongUri = await callback(app, {
        provider: 'google',
        code: 'code-ana',
        redirectUri: 'https://tostao.test/api/auth/apple/callback',
        state: state2,
      });
      expect(wrongUri.statusCode).toBe(400);
      expect(oauth.exchangeCalls).toHaveLength(0);
    });

    it('nonce e code_verifier vêm do servidor: o body do callback não consegue impor os dele', async () => {
      const { app, oauth } = await setup();
      const state = await start(app, 'google', GOOGLE_CB);
      const issued = oauth.authorizeCalls.at(-1)!;

      const res = await callback(app, {
        provider: 'google',
        code: 'code-ana',
        redirectUri: GOOGLE_CB,
        state,
        // tentativa de impor valores próprios (campos que o contrato nem aceita mais)
        expectedNonce: 'nonce-do-atacante-'.padEnd(40, 'x'),
        codeVerifier: 'verifier-do-atacante-'.padEnd(50, 'x'),
      });
      expect(res.statusCode).toBe(200);
      const exchange = oauth.exchangeCalls.at(-1)!;
      expect(exchange.expectedNonce).toBe(issued.nonce);
      expect(exchange.codeVerifier).toBeTruthy();
      // o verifier guardado é o par do challenge que foi pra URL de autorização
      expect(createHash('sha256').update(exchange.codeVerifier!).digest('base64url')).toBe(issued.codeChallenge);
    });

    it('Apple não usa PKCE', async () => {
      const { app, oauth } = await setup();
      await start(app, 'apple', 'https://tostao.test/api/auth/apple/callback');
      expect(oauth.authorizeCalls.at(-1)!.codeChallenge).toBeUndefined();
    });
  });

  describe('redirectUri', () => {
    const local = 'http://localhost:3000/api/auth/google/callback';
    const post = (app: App, redirectUri: string) =>
      app.inject({ method: 'POST', url: '/auth/oauth/start', payload: { provider: 'google', redirectUri } });
    const makeApp = (webOrigin: string) =>
      buildApp({
        repos: makeInMemoryRepositories(),
        bank: new FakeBankGateway(),
        oauth: new FakeOAuthGateway({}),
        jwtSecret: 'segredo-de-teste-123',
        webOrigin,
      });

    it('em produção, localhost e 127.0.0.1 falham mesmo com WEB_ORIGIN apontando pra produção', async () => {
      const app = await makeApp('https://tostao.test');
      vi.stubEnv('NODE_ENV', 'production');
      expect((await post(app, local)).statusCode).toBe(400);
      expect((await post(app, 'http://127.0.0.1:3000/api/auth/google/callback')).statusCode).toBe(400);
      expect((await post(app, GOOGLE_CB)).statusCode).toBe(200);
    });

    it('em produção exige https e a origem exata (WEB_ORIGIN "*" não libera nada)', async () => {
      const app = await makeApp('https://tostao.test');
      const star = await makeApp('*');
      vi.stubEnv('NODE_ENV', 'production');
      expect((await post(app, 'http://tostao.test/api/auth/google/callback')).statusCode).toBe(400);
      expect((await post(app, 'https://tostao.test.evil.com/api/auth/google/callback')).statusCode).toBe(400);
      expect((await post(app, 'https://tostao.test:8443/api/auth/google/callback')).statusCode).toBe(400);
      expect((await post(app, `${GOOGLE_CB}?x=1`)).statusCode).toBe(400);
      expect((await post(app, 'https://tostao.test/api/auth/apple/callback')).statusCode).toBe(400); // provedor errado na rota

      expect((await post(star, local)).statusCode).toBe(400);
      expect((await post(star, 'https://qualquer.com/api/auth/google/callback')).statusCode).toBe(400);
    });

    it('NODE_ENV vazio conta como produção (padrão seguro)', async () => {
      const app = await makeApp('https://tostao.test');
      vi.stubEnv('NODE_ENV', '');
      expect((await post(app, local)).statusCode).toBe(400);
    });

    it('em development e test, localhost passa; origem estrangeira continua barrada', async () => {
      const app = await makeApp('https://tostao.test');
      const star = await makeApp('*');
      for (const env of ['development', 'test']) {
        vi.stubEnv('NODE_ENV', env);
        expect((await post(app, local)).statusCode, env).toBe(200);
        expect((await post(app, 'https://evil.test/api/auth/google/callback')).statusCode, env).toBe(400);
      }
      expect((await post(star, 'https://evil.test/api/auth/google/callback')).statusCode).toBe(400);
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
      payload: { provider: 'google', redirectUri: 'http://localhost:3000/api/auth/google/callback' },
    });
    expect(res.statusCode).toBe(503);
  });
});
