// As Server Actions de auth, de ponta a ponta com a API simulada (fetch) e os cookies/redirect do Next.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

const session = vi.hoisted(() => ({ token: null as string | null, saved: [] as unknown[] }));
vi.mock('@/lib/session', () => ({
  getToken: async () => session.token,
  setSession: async (t: unknown) => void session.saved.push(t),
}));

import { confirmEmail, login, requestPasswordReset, resendVerification } from '../app/(auth)/actions';

const respond = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  session.token = null;
  session.saved = [];
  vi.unstubAllGlobals();
});

describe('login()', () => {
  it('senha errada com cookie vencido no navegador: devolve a mensagem da API (não NEXT_REDIRECT, não 500)', async () => {
    session.token = 'jwt-vencido';
    vi.stubGlobal('fetch', respond(401, { message: 'E-mail ou senha não batem.' }));
    const state = await login({}, form({ email: 'a@x.com', password: 'errada00' }));
    expect(state.error).toBe('E-mail ou senha não batem.');
    expect(session.saved).toHaveLength(0);
  });

  it('sucesso: grava access + refresh e redireciona (o redirect passa pelo catch intacto)', async () => {
    vi.stubGlobal('fetch', respond(200, { accessToken: 'A', refreshToken: 'R' }));
    const err = await login({}, form({ email: 'a@x.com', password: '12345678' })).catch((e) => e);
    expect(isRedirectError(err)).toBe(true);
    expect(session.saved).toEqual([{ accessToken: 'A', refreshToken: 'R' }]);
  });
});

describe('catch de Server Action não engole o redirect do api()', () => {
  it('resendVerification com sessão vencida (401): o NEXT_REDIRECT sobe, não vira { error }', async () => {
    session.token = 'jwt-vencido';
    vi.stubGlobal('fetch', respond(401));
    const err = await resendVerification().catch((e) => e);
    expect(isRedirectError(err)).toBe(true);
  });

  it('sem sessão: vai pro login', async () => {
    vi.stubGlobal('fetch', respond(401));
    const err = await resendVerification().catch((e) => e);
    expect(isRedirectError(err)).toBe(true);
    expect((err as { digest: string }).digest).toContain('/entrar');
  });

  it('erro comum (429) continua virando mensagem na tela', async () => {
    session.token = 'ok';
    vi.stubGlobal('fetch', respond(429, { message: 'Muitas tentativas. Espera um pouco e tenta de novo.' }));
    expect(await resendVerification()).toEqual({ error: 'Muitas tentativas. Espera um pouco e tenta de novo.' });
  });
});

describe('requestPasswordReset() e confirmEmail()', () => {
  it('a tela responde igual exista a conta ou não: sempre { done: true } quando a API dá 202', async () => {
    vi.stubGlobal('fetch', respond(202, { message: 'neutra' }));
    expect(await requestPasswordReset({}, form({ email: 'existe@x.com' }))).toEqual({ done: true });
    expect(await requestPasswordReset({}, form({ email: 'fantasma@x.com' }))).toEqual({ done: true });
  });

  it('e-mail malformado não chega na API; 429 e API fora do ar viram mensagem', async () => {
    const f = respond(202);
    vi.stubGlobal('fetch', f);
    expect((await requestPasswordReset({}, form({ email: 'nao-e-email' }))).error).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', respond(429, { message: 'Muitas tentativas.' }));
    expect(await requestPasswordReset({}, form({ email: 'a@x.com' }))).toEqual({ error: 'Muitas tentativas.' });
  });

  it('confirmEmail: link inválido mostra erro; válido, done', async () => {
    vi.stubGlobal('fetch', respond(400, { message: 'Esse link expirou ou já foi usado. Pede um novo.' }));
    expect((await confirmEmail({}, form({ token: 'a'.repeat(43) }))).error).toContain('expirou');
    vi.stubGlobal('fetch', respond(200, { verified: true }));
    expect(await confirmEmail({}, form({ token: 'a'.repeat(43) }))).toEqual({ done: true });
    expect((await confirmEmail({}, form({ token: 'curto' }))).error).toBeTruthy();
  });
});
