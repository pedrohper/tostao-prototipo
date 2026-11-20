import { createPublicKey, generateKeyPairSync, sign, verify, type JsonWebKey } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createAppleClientSecret, OidcOAuthGateway, safeEqualString, verifyOidcIdToken } from './oauth-gateway.js';

function makeRsaPair(kid: string) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...(publicKey.export({ format: 'jwk' }) as JsonWebKey), kid, alg: 'RS256', use: 'sig' };
  const signJwt = (payload: Record<string, unknown>, headerOverride?: Record<string, unknown>) => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, ...headerOverride })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
    return `${header}.${body}.${sig}`;
  };
  return { jwk, signJwt };
}

describe('OAuthGateway (Google e Apple)', () => {
  it('gera client_secret ES256 válido para a Apple e aceita PEM com \\n escapado', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const escapedPem = pem.replace(/\n/g, '\\n');

    const nowMs = Date.parse('2026-11-19T18:00:00Z');
    const jwt = createAppleClientSecret(
      {
        clientId: 'br.com.tostao.web',
        teamId: 'TEAM123456',
        keyId: 'KEY9876543',
        privateKey: escapedPem,
      },
      nowMs,
    );

    const [h, p, s] = jwt.split('.') as [string, string, string];
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY9876543' });
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toEqual({
      iss: 'TEAM123456',
      iat: Math.floor(nowMs / 1000),
      exp: Math.floor(nowMs / 1000) + 300,
      aud: 'https://appleid.apple.com',
      sub: 'br.com.tostao.web',
    });

    const ok = verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(s, 'base64url'),
    );
    expect(ok).toBe(true);
  });

  it('monta URL de autorização do Google (com PKCE) e da Apple (com form_post)', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const gw = new OidcOAuthGateway({
      google: { clientId: 'g-client', clientSecret: 'g-secret' },
      apple: {
        clientId: 'br.com.tostao.web',
        teamId: 'TEAM123456',
        keyId: 'KEY9876543',
        privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      },
    });

    const gUrl = new URL(
      gw.buildAuthorizeUrl({
        provider: 'google',
        redirectUri: 'https://app.tostao.test/api/auth/google/callback',
        state: 's'.repeat(32),
        nonce: 'n'.repeat(32),
        codeChallenge: 'c'.repeat(43),
      }),
    );
    expect(gUrl.origin + gUrl.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(gUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(gUrl.searchParams.get('scope')).toBe('openid email profile');

    const aUrl = new URL(
      gw.buildAuthorizeUrl({
        provider: 'apple',
        redirectUri: 'https://app.tostao.test/api/auth/apple/callback',
        state: 's'.repeat(32),
        nonce: 'n'.repeat(32),
      }),
    );
    expect(aUrl.origin + aUrl.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(aUrl.searchParams.get('response_mode')).toBe('form_post');
    expect(aUrl.searchParams.get('scope')).toBe('name email');
  });

  it('valida id_token RS256 e rejeita assinatura, nonce, emissor, audience e expiração inválidos', async () => {
    const key1 = makeRsaPair('k1');
    const key2 = makeRsaPair('k2');
    const nowMs = Date.parse('2026-11-19T18:00:00Z');
    const exp = Math.floor(nowMs / 1000) + 600;

    const valid = key1.signJwt({
      iss: 'https://accounts.google.com',
      aud: 'client-1',
      sub: 'google-sub-1',
      email: 'Ana@Exemplo.com',
      email_verified: true,
      name: 'Ana Silva',
      nonce: 'nonce-ok-1234567890',
      exp,
    });

    const parsed = await verifyOidcIdToken({
      idToken: valid,
      expectedIssuers: new Set(['https://accounts.google.com']),
      expectedAudience: 'client-1',
      expectedNonce: 'nonce-ok-1234567890',
      getKey: async (kid) => (kid === 'k1' ? key1.jwk : null),
      nowMs,
    });
    expect(parsed).toEqual({
      sub: 'google-sub-1',
      email: 'ana@exemplo.com',
      emailVerified: true,
      name: 'Ana Silva',
    });

    // Assinatura feita com outra chave mas anunciando kid k1
    const forged = key2.signJwt(
      {
        iss: 'https://accounts.google.com',
        aud: 'client-1',
        sub: 'google-sub-1',
        email: 'ana@exemplo.com',
        email_verified: true,
        nonce: 'nonce-ok-1234567890',
        exp,
      },
      { kid: 'k1' },
    );
    await expect(
      verifyOidcIdToken({
        idToken: forged,
        expectedIssuers: new Set(['https://accounts.google.com']),
        expectedAudience: 'client-1',
        expectedNonce: 'nonce-ok-1234567890',
        getKey: async () => key1.jwk,
        nowMs,
      }),
    ).rejects.toThrow(/Assinatura/);

    // Nonce errado
    await expect(
      verifyOidcIdToken({
        idToken: valid,
        expectedIssuers: new Set(['https://accounts.google.com']),
        expectedAudience: 'client-1',
        expectedNonce: 'outro-nonce-123456',
        getKey: async () => key1.jwk,
        nowMs,
      }),
    ).rejects.toThrow(/segurança/);

    // Expirado
    await expect(
      verifyOidcIdToken({
        idToken: valid,
        expectedIssuers: new Set(['https://accounts.google.com']),
        expectedAudience: 'client-1',
        expectedNonce: 'nonce-ok-1234567890',
        getKey: async () => key1.jwk,
        nowMs: nowMs + 1000 * 1000,
      }),
    ).rejects.toThrow(/expirou/);

    // Audience errada
    await expect(
      verifyOidcIdToken({
        idToken: valid,
        expectedIssuers: new Set(['https://accounts.google.com']),
        expectedAudience: 'outro-client',
        expectedNonce: 'nonce-ok-1234567890',
        getKey: async () => key1.jwk,
        nowMs,
      }),
    ).rejects.toThrow(/Destinatário/);
  });

  it('troca o code do Google e da Apple validando o JWKS remoto (com refresh quando rotaciona kid)', async () => {
    const gKey1 = makeRsaPair('gk1');
    const gKey2 = makeRsaPair('gk2');
    const aKey = makeRsaPair('ak1');
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const nowMs = Date.parse('2026-11-19T18:00:00Z');
    const exp = Math.floor(nowMs / 1000) + 600;

    let googleJwksCalls = 0;
    const fakeFetch: typeof fetch = async (url, init) => {
      const target = String(url);
      if (target === 'https://oauth2.googleapis.com/token') {
        const params = new URLSearchParams(String(init?.body ?? ''));
        const kid = params.get('code') === 'code-rotated' ? gKey2 : gKey1;
        return new Response(
          JSON.stringify({
            id_token: kid.signJwt({
              iss: 'https://accounts.google.com',
              aud: 'g-client',
              sub: 'g-123',
              email: 'pedro@gmail.com',
              email_verified: true,
              name: 'Pedro',
              nonce: 'nonce-1234567890123456',
              exp,
            }),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (target === 'https://www.googleapis.com/oauth2/v3/certs') {
        googleJwksCalls++;
        const keys = googleJwksCalls === 1 ? [gKey1.jwk] : [gKey1.jwk, gKey2.jwk];
        return new Response(JSON.stringify({ keys }), { status: 200 });
      }
      if (target === 'https://appleid.apple.com/auth/token') {
        const params = new URLSearchParams(String(init?.body ?? ''));
        // Verifica que client_secret enviado é ES256 válido
        const cs = params.get('client_secret')!;
        const [h, p, s] = cs.split('.') as [string, string, string];
        const pub = createPublicKey(ec.privateKey);
        expect(
          verify(
            'sha256',
            Buffer.from(`${h}.${p}`),
            { key: pub, dsaEncoding: 'ieee-p1363' },
            Buffer.from(s, 'base64url'),
          ),
        ).toBe(true);
        return new Response(
          JSON.stringify({
            id_token: aKey.signJwt({
              iss: 'https://appleid.apple.com',
              aud: 'br.com.tostao.web',
              sub: 'apple-sub-9',
              email: 'priv@privaterelay.appleid.com',
              email_verified: 'true',
              is_private_email: 'true',
              nonce: 'nonce-apple-1234567890',
              exp,
            }),
          }),
          { status: 200 },
        );
      }
      if (target === 'https://appleid.apple.com/auth/keys') {
        return new Response(JSON.stringify({ keys: [aKey.jwk] }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    };

    let clockOffsetMs = 0;
    const gw = new OidcOAuthGateway({
      google: { clientId: 'g-client', clientSecret: 'g-secret' },
      apple: {
        clientId: 'br.com.tostao.web',
        teamId: 'TEAM123456',
        keyId: 'KEY9876543',
        privateKey: ec.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      },
      fetchImpl: fakeFetch,
      clock: () => nowMs + clockOffsetMs,
    });

    const g1 = await gw.exchangeCode({
      provider: 'google',
      code: 'code-1',
      redirectUri: 'https://app.tostao.test/api/auth/google/callback',
      codeVerifier: 'v'.repeat(43),
      expectedNonce: 'nonce-1234567890123456',
    });
    expect(g1).toEqual({
      provider: 'google',
      providerAccountId: 'g-123',
      email: 'pedro@gmail.com',
      emailVerified: true,
      name: 'Pedro',
    });

    // Rotação de chave: kid gk2 não está no cache -> baixa JWKS de novo (depois do cooldown de 60 s)
    clockOffsetMs = 61_000;
    const g2 = await gw.exchangeCode({
      provider: 'google',
      code: 'code-rotated',
      redirectUri: 'https://app.tostao.test/api/auth/google/callback',
      codeVerifier: 'v'.repeat(43),
      expectedNonce: 'nonce-1234567890123456',
    });
    expect(g2.providerAccountId).toBe('g-123');
    expect(googleJwksCalls).toBe(2);

    const a1 = await gw.exchangeCode({
      provider: 'apple',
      code: 'apple-code',
      redirectUri: 'https://app.tostao.test/api/auth/apple/callback',
      expectedNonce: 'nonce-apple-1234567890',
    });
    expect(a1).toEqual({
      provider: 'apple',
      providerAccountId: 'apple-sub-9',
      email: 'priv@privaterelay.appleid.com',
      emailVerified: true,
      name: null,
    });
  });
});

const ISS = 'https://accounts.google.com';
const NOW_MS = Date.parse('2026-11-19T18:00:00Z');
const NOW_SEC = Math.floor(NOW_MS / 1000);

describe('verifyOidcIdToken: claims', () => {
  const key = makeRsaPair('k1');
  const verifyWith = (claims: Record<string, unknown>) =>
    verifyOidcIdToken({
      idToken: key.signJwt({
        iss: ISS,
        aud: 'client-1',
        sub: 'sub-1',
        email: 'ana@exemplo.com',
        email_verified: true,
        nonce: 'nonce-ok-1234567890',
        exp: NOW_SEC + 600,
        ...claims,
      }),
      expectedIssuers: new Set([ISS]),
      expectedAudience: 'client-1',
      expectedNonce: 'nonce-ok-1234567890',
      getKey: async () => key.jwk,
      nowMs: NOW_MS,
    });

  it('só email_verified conta: is_private_email: true com email_verified: false NÃO é e-mail verificado', async () => {
    const r1 = await verifyWith({ email_verified: false, is_private_email: true });
    expect(r1.emailVerified).toBe(false);
    const r2 = await verifyWith({ email_verified: false, is_private_email: 'true' });
    expect(r2.emailVerified).toBe(false);
    const r3 = await verifyWith({ email_verified: undefined, is_private_email: 'true' }); // ausente
    expect(r3.emailVerified).toBe(false);
    // Apple manda "true" como string
    expect((await verifyWith({ email_verified: 'true' })).emailVerified).toBe(true);
  });

  it('nbf: token que só vale no futuro é rejeitado; dentro dos 60 s de tolerância passa', async () => {
    await expect(verifyWith({ nbf: NOW_SEC + 3600 })).rejects.toThrow(/ainda não é válido/);
    await expect(verifyWith({ nbf: NOW_SEC + 61 })).rejects.toThrow(/ainda não é válido/);
    await expect(verifyWith({ nbf: NOW_SEC + 30 })).resolves.toBeTruthy();
    await expect(verifyWith({ nbf: NOW_SEC - 10 })).resolves.toBeTruthy();
  });

  it('iat no futuro é rejeitado', async () => {
    await expect(verifyWith({ iat: NOW_SEC + 3600 })).rejects.toThrow(/data inválida/);
    await expect(verifyWith({ iat: NOW_SEC - 5 })).resolves.toBeTruthy();
  });

  it('aud em lista exige azp igual ao nosso client_id', async () => {
    await expect(verifyWith({ aud: ['client-1', 'outro-app'] })).rejects.toThrow(/Autorizador/); // sem azp
    await expect(verifyWith({ aud: ['client-1', 'outro-app'], azp: 'outro-app' })).rejects.toThrow(/Autorizador/);
    await expect(verifyWith({ aud: ['client-1', 'outro-app'], azp: 'client-1' })).resolves.toBeTruthy();
    // aud em string não precisa de azp
    await expect(verifyWith({ aud: 'client-1' })).resolves.toBeTruthy();
  });
});

describe('safeEqualString', () => {
  it('compara sem depender do tamanho', () => {
    expect(safeEqualString('abc', 'abc')).toBe(true);
    expect(safeEqualString('abc', 'abd')).toBe(false);
    expect(safeEqualString('abc', 'abcd')).toBe(false);
    expect(safeEqualString('', 'a')).toBe(false);
  });
});

describe('OidcOAuthGateway: PKCE, timeout e JWKS', () => {
  const google = { clientId: 'g-client', clientSecret: 'g-secret' };
  const CB = 'https://app.tostao.test/api/auth/google/callback';

  it('Google exige PKCE: sem code_challenge na ida ou sem code_verifier na volta, falha', async () => {
    const gw = new OidcOAuthGateway({ google });
    expect(() => gw.buildAuthorizeUrl({ provider: 'google', redirectUri: CB, state: 's', nonce: 'n' })).toThrow(/PKCE/);
    await expect(
      gw.exchangeCode({ provider: 'google', code: 'c', redirectUri: CB, expectedNonce: 'n' }),
    ).rejects.toThrow(/PKCE/);
  });

  it('todo fetch sai com timeout (AbortSignal)', async () => {
    const key = makeRsaPair('k1');
    const signals: (AbortSignal | undefined)[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      signals.push(init?.signal ?? undefined);
      if (String(url).includes('token')) {
        return new Response(
          JSON.stringify({
            id_token: key.signJwt({
              iss: ISS,
              aud: 'g-client',
              sub: 's',
              email: 'a@b.com',
              email_verified: true,
              nonce: 'nonce-1234567890123456',
              exp: NOW_SEC + 600,
            }),
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ keys: [key.jwk] }), { status: 200 });
    }) as typeof fetch;
    const gw = new OidcOAuthGateway({ google, fetchImpl, clock: () => NOW_MS });
    await gw.exchangeCode({
      provider: 'google',
      code: 'c',
      redirectUri: CB,
      codeVerifier: 'v'.repeat(43),
      expectedNonce: 'nonce-1234567890123456',
    });
    expect(signals).toHaveLength(2); // token + JWKS
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('timeout do provedor vira erro 502 amigável, não trava', async () => {
    const fetchImpl = (async () => {
      throw new DOMException('timeout', 'TimeoutError');
    }) as unknown as typeof fetch;
    const gw = new OidcOAuthGateway({ google, fetchImpl });
    await expect(
      gw.exchangeCode({
        provider: 'google',
        code: 'c',
        redirectUri: CB,
        codeVerifier: 'v'.repeat(43),
        expectedNonce: 'n',
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it('kid desconhecido não vira um download do JWKS por requisição: 1 por minuto', async () => {
    const key = makeRsaPair('k1');
    let jwksCalls = 0;
    let offset = 0;
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes('token')) {
        const bad = makeRsaPair('kid-inventado');
        return new Response(
          JSON.stringify({
            id_token: bad.signJwt({
              iss: ISS,
              aud: 'g-client',
              sub: 's',
              email: 'a@b.com',
              email_verified: true,
              nonce: 'nonce-1234567890123456',
              exp: NOW_SEC + 3600,
            }),
          }),
          { status: 200 },
        );
      }
      jwksCalls++;
      return new Response(JSON.stringify({ keys: [key.jwk] }), { status: 200 });
    }) as typeof fetch;
    const gw = new OidcOAuthGateway({ google, fetchImpl, clock: () => NOW_MS + offset });
    const attempt = () =>
      gw.exchangeCode({
        provider: 'google',
        code: 'c',
        redirectUri: CB,
        codeVerifier: 'v'.repeat(43),
        expectedNonce: 'nonce-1234567890123456',
      });

    for (let i = 0; i < 10; i++) await expect(attempt()).rejects.toMatchObject({ statusCode: 401 });
    expect(jwksCalls).toBe(1); // 10 tentativas, 1 download
    offset = 61_000; // passou o cooldown: pode olhar de novo (rotação legítima)
    await expect(attempt()).rejects.toMatchObject({ statusCode: 401 });
    expect(jwksCalls).toBe(2);
  });

  it('falha ao baixar o JWKS também respeita o cooldown', async () => {
    let jwksCalls = 0;
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes('token')) {
        const k = makeRsaPair('k1');
        return new Response(
          JSON.stringify({
            id_token: k.signJwt({
              iss: ISS,
              aud: 'g-client',
              sub: 's',
              email: 'a@b.com',
              email_verified: true,
              nonce: 'nonce-1234567890123456',
              exp: NOW_SEC + 3600,
            }),
          }),
          { status: 200 },
        );
      }
      jwksCalls++;
      return new Response('boom', { status: 500 });
    }) as typeof fetch;
    const gw = new OidcOAuthGateway({ google, fetchImpl, clock: () => NOW_MS });
    const attempt = () =>
      gw.exchangeCode({
        provider: 'google',
        code: 'c',
        redirectUri: CB,
        codeVerifier: 'v'.repeat(43),
        expectedNonce: 'nonce-1234567890123456',
      });
    for (let i = 0; i < 5; i++) await expect(attempt()).rejects.toMatchObject({ statusCode: 502 });
    expect(jwksCalls).toBe(1);
  });
});
