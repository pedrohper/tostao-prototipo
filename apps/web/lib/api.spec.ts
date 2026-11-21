import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

const session = vi.hoisted(() => ({ token: null as string | null }));
vi.mock('./session', () => ({ getToken: async () => session.token }));

import { api, ApiError } from './api';

const respond = (status: number, body: unknown = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));
const redirectTarget = (e: unknown) => (e as { digest: string }).digest.split(';')[2];

beforeEach(() => {
  session.token = null;
  vi.unstubAllGlobals();
});

describe('api(): 401', () => {
  it('skipAuthRedirect com cookie VENCIDO (login com senha errada): vira ApiError 401, não NEXT_REDIRECT', async () => {
    session.token = 'jwt-vencido';
    vi.stubGlobal('fetch', respond(401, { message: 'E-mail ou senha não batem.' }));
    const err = await api('/sessions', { method: 'POST', body: {}, skipAuthRedirect: true }).catch((e) => e);
    expect(isRedirectError(err)).toBe(false);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: 'E-mail ou senha não batem.' });
  });

  it('skipAuthRedirect sem cookie: também ApiError', async () => {
    vi.stubGlobal('fetch', respond(401, { message: 'nope' }));
    const err = await api('/sessions', { method: 'POST', body: {}, skipAuthRedirect: true }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
  });

  it('com sessão e 401 normal (token não renovou): redireciona pra /sair (que limpa os cookies)', async () => {
    session.token = 'jwt-vencido';
    vi.stubGlobal('fetch', respond(401));
    const err = await api('/me').catch((e) => e);
    expect(isRedirectError(err)).toBe(true);
    expect(redirectTarget(err)).toBe('/sair');
  });

  it('sem sessão e 401: redireciona pra /entrar', async () => {
    vi.stubGlobal('fetch', respond(401));
    const err = await api('/me').catch((e) => e);
    expect(isRedirectError(err)).toBe(true);
    expect(redirectTarget(err)).toBe('/entrar');
  });

  it('envia o access token no Authorization e devolve o JSON em 200', async () => {
    session.token = 'abc';
    const f = respond(200, { ok: 1 });
    vi.stubGlobal('fetch', f);
    expect(await api('/me')).toEqual({ ok: 1 });
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({
      authorization: 'Bearer abc',
    });
  });

  it('API fora do ar → ApiError 503; erro 4xx/5xx da API carrega message e code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))),
    );
    expect(await api('/me').catch((e) => e)).toMatchObject({ status: 503 });
    vi.stubGlobal('fetch', respond(403, { message: 'Aceite o aviso', code: 'AI_CONSENT_REQUIRED' }));
    expect(await api('/chat').catch((e) => e)).toMatchObject({ status: 403, code: 'AI_CONSENT_REQUIRED' });
  });
});
