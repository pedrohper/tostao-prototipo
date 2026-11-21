import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MemoryKeyValueStore } from '../lib/redis.js';
import { OAUTH_STATE_TTL_SECONDS, OAuthStateStore } from './oauth-state.js';

const CB = 'https://tostao.test/api/auth/google/callback';

describe('OAuthStateStore', () => {
  it('state, nonce e code_verifier têm 256 bits e nunca se repetem', async () => {
    const store = new OAuthStateStore(new MemoryKeyValueStore());
    const a = await store.begin({ provider: 'google', redirectUri: CB });
    const b = await store.begin({ provider: 'google', redirectUri: CB });
    for (const v of [a.state, a.nonce, b.state, b.nonce]) expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it('guarda tudo no servidor e devolve uma vez só', async () => {
    const store = new OAuthStateStore(new MemoryKeyValueStore());
    const { state, nonce, codeChallenge } = await store.begin({
      provider: 'google',
      redirectUri: CB,
      inviteCode: 'ABC123',
      from: 'criar-conta',
    });
    const saved = await store.consume(state);
    expect(saved).toMatchObject({
      provider: 'google',
      nonce,
      redirectUri: CB,
      inviteCode: 'ABC123',
      from: 'criar-conta',
    });
    expect(createHash('sha256').update(saved!.codeVerifier!).digest('base64url')).toBe(codeChallenge);
    expect(await store.consume(state)).toBeNull(); // replay
  });

  it('Apple não tem code_verifier; "from" padrão é entrar', async () => {
    const store = new OAuthStateStore(new MemoryKeyValueStore());
    const { state, codeChallenge } = await store.begin({ provider: 'apple', redirectUri: CB });
    expect(codeChallenge).toBeUndefined();
    const saved = await store.consume(state);
    expect(saved!.codeVerifier).toBeUndefined();
    expect(saved!.from).toBe('entrar');
  });

  it('expira em 5 minutos', async () => {
    let now = 0;
    const store = new OAuthStateStore(new MemoryKeyValueStore(() => now));
    const { state } = await store.begin({ provider: 'google', redirectUri: CB });
    now = OAUTH_STATE_TTL_SECONDS * 1000;
    expect(OAUTH_STATE_TTL_SECONDS).toBe(300);
    expect(await store.consume(state)).toBeNull();
  });

  it('state fora do formato nem consulta o store', async () => {
    const store = new OAuthStateStore(new MemoryKeyValueStore());
    for (const bad of ['', 'x', 'A'.repeat(44), `${'A'.repeat(42)}*`, '../../etc']) {
      expect(await store.consume(bad)).toBeNull();
    }
  });
});
