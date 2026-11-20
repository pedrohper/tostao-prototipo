// Estado do login social guardado NO SERVIDOR, ligado ao "state" que vai e volta pelo navegador.
// Antes, o nonce e o code_verifier viajavam pelo cliente (cookie/body) e o servidor não conferia nada:
// quem forjasse o corpo do callback escolhia o próprio nonce. Agora o callback só vale com um state que
// a gente emitiu, que ainda não foi usado e que não expirou (uso único, via GETDEL).
import { createHash, randomBytes } from 'node:crypto';
import { OAUTH_STATE_PATTERN } from '@tostao/contracts';
import type { OAuthProvider } from '../domain/entities.js';
import type { KeyValueStore } from '../lib/redis.js';

export const OAUTH_STATE_TTL_SECONDS = 5 * 60;

export type OAuthFrom = 'entrar' | 'criar-conta';

export type OAuthStateRecord = {
  provider: OAuthProvider;
  nonce: string;
  codeVerifier?: string;
  redirectUri: string;
  inviteCode?: string;
  from: OAuthFrom;
};

const key = (state: string) => `oauth:state:${state}`;
const random = () => randomBytes(32).toString('base64url'); // 256 bits

export class OAuthStateStore {
  constructor(private readonly kv: KeyValueStore) {}

  /** Cria o state e guarda o resto. Google ganha PKCE (S256); a Apple não usa. */
  async begin(input: { provider: OAuthProvider; redirectUri: string; inviteCode?: string; from?: OAuthFrom }) {
    const state = random();
    const nonce = random();
    const codeVerifier = input.provider === 'google' ? random() : undefined;
    const codeChallenge = codeVerifier ? createHash('sha256').update(codeVerifier).digest('base64url') : undefined;
    const record: OAuthStateRecord = {
      provider: input.provider,
      nonce,
      codeVerifier,
      redirectUri: input.redirectUri,
      inviteCode: input.inviteCode || undefined,
      from: input.from ?? 'entrar',
    };
    await this.kv.set(key(state), JSON.stringify(record), OAUTH_STATE_TTL_SECONDS);
    return { state, nonce, codeChallenge };
  }

  /** Uso único: lê e apaga. null = nunca existiu, expirou ou já foi usado (replay). */
  async consume(state: string): Promise<OAuthStateRecord | null> {
    if (!OAUTH_STATE_PATTERN.test(state)) return null;
    const raw = await this.kv.getdel(key(state));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OAuthStateRecord;
    } catch {
      return null;
    }
  }
}
