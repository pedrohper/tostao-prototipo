// Gateway de login social (Google e Apple) usando apenas node:crypto + fetch (sem dependências extras).
// Google: OAuth 2.0 Authorization Code + PKCE (S256) + verificação RS256 do id_token via JWKS.
// Apple:  Sign in with Apple (form_post) + client_secret ES256 assinado com chave .p8 + verificação RS256 do id_token via JWKS.
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  timingSafeEqual,
  verify,
  type JsonWebKey,
} from 'node:crypto';
import type { OAuthProvider } from '../domain/entities.js';
import { AppError } from '../domain/errors.js';

export type OAuthIdentity = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export type OAuthAuthorizeInput = {
  provider: OAuthProvider;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge?: string;
};

export type OAuthExchangeInput = {
  provider: OAuthProvider;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  expectedNonce: string;
};

export interface OAuthGateway {
  isEnabled(provider: OAuthProvider): boolean;
  enabledProviders(): { google: boolean; apple: boolean };
  buildAuthorizeUrl(input: OAuthAuthorizeInput): string;
  exchangeCode(input: OAuthExchangeInput): Promise<OAuthIdentity>;
}

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
};

export type AppleOAuthConfig = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

export type OidcOAuthConfig = {
  google?: GoogleOAuthConfig;
  apple?: AppleOAuthConfig;
  fetchImpl?: typeof fetch;
  clock?: () => number;
};

type JwkWithKid = JsonWebKey & { kid?: string; alg?: string; use?: string };
type JwksCacheEntry = { keys: JwkWithKid[]; fetchedAt: number };

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUERS = new Set(['https://appleid.apple.com']);

const JWKS_TTL_MS = 60 * 60 * 1000;
// Kid desconhecido não pode virar um download das chaves do provedor a cada requisição: no máximo 1 por minuto.
const JWKS_MISS_COOLDOWN_MS = 60 * 1000;
const CLOCK_SKEW_SEC = 60;
const FETCH_TIMEOUT_MS = 10_000;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecodeJson<T>(segment: string): T {
  const raw = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(raw) as T;
}

/** Compara em tempo constante e sem vazar o tamanho: os dois lados viram SHA-256 (32 bytes) antes. */
export function safeEqualString(a: string, b: string): boolean {
  const hash = (v: string) => createHash('sha256').update(v, 'utf8').digest();
  return timingSafeEqual(hash(a), hash(b));
}

function isTruthyFlag(v: unknown): boolean {
  return v === true || v === 'true';
}

/** Gera o client_secret JWT (ES256) exigido pela Apple na troca do código de autorização. */
export function createAppleClientSecret(config: AppleOAuthConfig, nowMs = Date.now()): string {
  const nowSec = Math.floor(nowMs / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: config.teamId,
      iat: nowSec,
      exp: nowSec + 300, // 5 min (limite da Apple é 6 meses; curto é mais seguro)
      aud: 'https://appleid.apple.com',
      sub: config.clientId,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const normalizedPem = config.privateKey.replace(/\\n/g, '\n').trim();
  const key = createPrivateKey(normalizedPem);
  const signature = sign('sha256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export type VerifyIdTokenOptions = {
  idToken: string;
  expectedIssuers: Set<string>;
  expectedAudience: string;
  expectedNonce: string;
  getKey: (kid: string) => Promise<JwkWithKid | null>;
  nowMs?: number;
};

export type VerifiedIdTokenPayload = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

/** Verifica assinatura RS256 e claims obrigatórias (iss, aud, exp, nonce, sub, email) de um id_token OIDC. */
export async function verifyOidcIdToken({
  idToken,
  expectedIssuers,
  expectedAudience,
  expectedNonce,
  getKey,
  nowMs = Date.now(),
}: VerifyIdTokenOptions): Promise<VerifiedIdTokenPayload> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new AppError('Token de login inválido.', 401);
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = base64UrlDecodeJson<{ alg?: string; kid?: string }>(headerB64);
    payload = base64UrlDecodeJson<Record<string, unknown>>(payloadB64);
  } catch {
    throw new AppError('Token de login malformado.', 401);
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new AppError('Algoritmo ou chave do token de login inválido.', 401);
  }

  const jwk = await getKey(header.kid);
  if (!jwk) throw new AppError('Não consegui validar a assinatura do provedor.', 401);

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`);
  const signature = Buffer.from(signatureB64, 'base64url');
  const validSignature = verify('RSA-SHA256', signingInput, publicKey, signature);
  if (!validSignature) throw new AppError('Assinatura do token de login inválida.', 401);

  const nowSec = Math.floor(nowMs / 1000);
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  if (!expectedIssuers.has(iss)) throw new AppError('Emissor do token de login inválido.', 401);

  const aud = payload.aud;
  const audMatches =
    typeof aud === 'string' ? aud === expectedAudience : Array.isArray(aud) && aud.includes(expectedAudience);
  if (!audMatches) throw new AppError('Destinatário do token de login inválido.', 401);

  // Com mais de um destinatário (aud em lista), o OIDC manda o azp: quem pediu o token tem que ser o nosso app.
  if (Array.isArray(aud) && payload.azp !== expectedAudience) {
    throw new AppError('Autorizador do token de login inválido.', 401);
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  if (exp + CLOCK_SKEW_SEC < nowSec) throw new AppError('Sessão de login expirou. Tenta de novo.', 401);
  // "Não vale antes de": token emitido pro futuro (ou com relógio muito adiantado) é rejeitado.
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_SEC > nowSec) {
    throw new AppError('Token de login ainda não é válido.', 401);
  }
  if (typeof payload.iat === 'number' && payload.iat - CLOCK_SKEW_SEC > nowSec) {
    throw new AppError('Token de login com data inválida.', 401);
  }

  const nonce = typeof payload.nonce === 'string' ? payload.nonce : '';
  if (!nonce || !safeEqualString(nonce, expectedNonce)) {
    throw new AppError('Validação de segurança do login falhou. Tenta de novo.', 401);
  }

  const sub = typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : '';
  const email =
    typeof payload.email === 'string' && payload.email.includes('@') ? payload.email.trim().toLowerCase() : '';
  if (!sub || !email) {
    throw new AppError('O provedor não retornou seu e-mail.', 400);
  }

  // Só email_verified vale. is_private_email (Apple) diz que o e-mail é um relay privado, não que foi verificado.
  const emailVerified = isTruthyFlag(payload.email_verified);
  const name = typeof payload.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : null;

  return { sub, email, emailVerified, name };
}

export class OidcOAuthGateway implements OAuthGateway {
  private readonly jwksCache = new Map<string, JwksCacheEntry>();
  private readonly jwksFailedAt = new Map<string, number>();
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;

  constructor(private readonly config: OidcOAuthConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.clock = config.clock ?? (() => Date.now());
  }

  isEnabled(provider: OAuthProvider): boolean {
    if (provider === 'google') return Boolean(this.config.google?.clientId && this.config.google?.clientSecret);
    return Boolean(
      this.config.apple?.clientId &&
      this.config.apple?.teamId &&
      this.config.apple?.keyId &&
      this.config.apple?.privateKey,
    );
  }

  enabledProviders(): { google: boolean; apple: boolean } {
    return {
      google: this.isEnabled('google'),
      apple: this.isEnabled('apple'),
    };
  }

  buildAuthorizeUrl({ provider, redirectUri, state, nonce, codeChallenge }: OAuthAuthorizeInput): string {
    if (!this.isEnabled(provider)) {
      throw new AppError(
        `Login com ${provider === 'google' ? 'Google' : 'Apple'} ainda não está ativado neste servidor.`,
        503,
      );
    }

    if (provider === 'google') {
      // PKCE (S256) é obrigatório: sem o challenge, um code interceptado serviria pra qualquer um.
      if (!codeChallenge) throw new AppError('Login com Google exige PKCE.', 500);
      const url = new URL(GOOGLE_AUTH_URL);
      url.searchParams.set('client_id', this.config.google!.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('prompt', 'select_account');
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    }

    const url = new URL(APPLE_AUTH_URL);
    url.searchParams.set('client_id', this.config.apple!.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'form_post');
    url.searchParams.set('scope', 'name email');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return url.toString();
  }

  async exchangeCode({
    provider,
    code,
    redirectUri,
    codeVerifier,
    expectedNonce,
  }: OAuthExchangeInput): Promise<OAuthIdentity> {
    if (!this.isEnabled(provider)) {
      throw new AppError(
        `Login com ${provider === 'google' ? 'Google' : 'Apple'} ainda não está ativado neste servidor.`,
        503,
      );
    }

    if (provider === 'google') {
      if (!codeVerifier) throw new AppError('Login com Google exige PKCE.', 400);
      const g = this.config.google!;
      const body = new URLSearchParams({
        code,
        client_id: g.clientId,
        client_secret: g.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
      body.set('code_verifier', codeVerifier);

      const res = await this.fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }).catch(() => {
        throw new AppError('Não consegui falar com o Google agora. Tenta de novo.', 502);
      });

      const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
      if (!res.ok || !data.id_token) {
        throw new AppError('Não consegui confirmar seu login com o Google. Tenta de novo.', 401);
      }

      const verified = await verifyOidcIdToken({
        idToken: data.id_token,
        expectedIssuers: GOOGLE_ISSUERS,
        expectedAudience: g.clientId,
        expectedNonce,
        getKey: (kid) => this.findJwk(GOOGLE_JWKS_URL, kid),
        nowMs: this.clock(),
      });
      return {
        provider: 'google',
        providerAccountId: verified.sub,
        email: verified.email,
        emailVerified: verified.emailVerified,
        name: verified.name,
      };
    }

    const a = this.config.apple!;
    const clientSecret = createAppleClientSecret(a, this.clock());
    const body = new URLSearchParams({
      code,
      client_id: a.clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await this.fetchImpl(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).catch(() => {
      throw new AppError('Não consegui falar com a Apple agora. Tenta de novo.', 502);
    });

    const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
    if (!res.ok || !data.id_token) {
      throw new AppError('Não consegui confirmar seu login com a Apple. Tenta de novo.', 401);
    }

    const verified = await verifyOidcIdToken({
      idToken: data.id_token,
      expectedIssuers: APPLE_ISSUERS,
      expectedAudience: a.clientId,
      expectedNonce,
      getKey: (kid) => this.findJwk(APPLE_JWKS_URL, kid),
      nowMs: this.clock(),
    });
    return {
      provider: 'apple',
      providerAccountId: verified.sub,
      email: verified.email,
      emailVerified: verified.emailVerified,
      name: verified.name,
    };
  }

  private async findJwk(jwksUrl: string, kid: string): Promise<JwkWithKid | null> {
    const now = this.clock();
    const cached = this.jwksCache.get(jwksUrl);
    if (cached && now - cached.fetchedAt < JWKS_TTL_MS) {
      const hit = cached.keys.find((k) => k.kid === kid);
      if (hit) return hit;
      // kid que não está no cache: só baixa de novo se o último download já passou do cooldown
      // (rotação de chave do provedor é legítima; kid inventado por atacante não pode virar 1 request por tentativa).
      if (now - cached.fetchedAt < JWKS_MISS_COOLDOWN_MS) return null;
    }
    const failedAt = this.jwksFailedAt.get(jwksUrl);
    if (failedAt !== undefined && now - failedAt < JWKS_MISS_COOLDOWN_MS) {
      throw new AppError('Não consegui baixar as chaves de segurança do provedor.', 502);
    }

    const res = await this.fetchImpl(jwksUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null);
    if (!res || !res.ok) {
      this.jwksFailedAt.set(jwksUrl, now);
      throw new AppError('Não consegui baixar as chaves de segurança do provedor.', 502);
    }
    this.jwksFailedAt.delete(jwksUrl);

    const body = (await res.json().catch(() => ({}))) as { keys?: JwkWithKid[] };
    const keys = Array.isArray(body.keys) ? body.keys : [];
    this.jwksCache.set(jwksUrl, { keys, fetchedAt: now });
    return keys.find((k) => k.kid === kid) ?? null;
  }
}

export class DisabledOAuthGateway implements OAuthGateway {
  isEnabled(): boolean {
    return false;
  }
  enabledProviders() {
    return { google: false, apple: false };
  }
  buildAuthorizeUrl({ provider }: OAuthAuthorizeInput): string {
    throw new AppError(
      `Login com ${provider === 'google' ? 'Google' : 'Apple'} ainda não está ativado neste servidor.`,
      503,
    );
  }
  async exchangeCode({ provider }: OAuthExchangeInput): Promise<OAuthIdentity> {
    throw new AppError(
      `Login com ${provider === 'google' ? 'Google' : 'Apple'} ainda não está ativado neste servidor.`,
      503,
    );
  }
}
