import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshSession, resetRefreshSessionCache } from './refresh-session';

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const apiUrl = 'http://api.test';

beforeEach(() => resetRefreshSessionCache());

describe('refreshSession', () => {
  it('chama POST /sessions/refresh com o refresh token no corpo e timeout', async () => {
    const f = vi.fn(async (_u: string, _i: RequestInit) => ok({ accessToken: 'A2', refreshToken: 'R2' }));
    const r = await refreshSession('R1', { fetch: f as unknown as typeof fetch, apiUrl });
    expect(r).toEqual({ status: 'ok', accessToken: 'A2', refreshToken: 'R2' });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://api.test/sessions/refresh');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'R1' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('requisições simultâneas com o MESMO refresh token fazem 1 chamada só (senão a 2ª pareceria roubo e derrubaria a sessão)', async () => {
    const f = vi.fn(async () => ok({ accessToken: 'A2', refreshToken: 'R2' }));
    const results = await Promise.all(
      Array.from({ length: 6 }, () => refreshSession('R1', { fetch: f as unknown as typeof fetch, apiUrl })),
    );
    expect(f).toHaveBeenCalledOnce();
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
    // e um retardatário logo depois, ainda com o cookie velho, recebe o mesmo par
    expect(await refreshSession('R1', { fetch: f as unknown as typeof fetch, apiUrl })).toMatchObject({
      refreshToken: 'R2',
    });
    expect(f).toHaveBeenCalledOnce();
  });

  it('refresh tokens diferentes não se misturam', async () => {
    const f = vi.fn(async (_u: string, i: RequestInit) =>
      ok({ accessToken: 'A', refreshToken: `novo-${JSON.parse(i.body as string).refreshToken}` }),
    );
    const [a, b] = await Promise.all([
      refreshSession('X', { fetch: f as unknown as typeof fetch, apiUrl }),
      refreshSession('Y', { fetch: f as unknown as typeof fetch, apiUrl }),
    ]);
    expect(f).toHaveBeenCalledTimes(2);
    expect(a).toMatchObject({ refreshToken: 'novo-X' });
    expect(b).toMatchObject({ refreshToken: 'novo-Y' });
  });

  it('401 da API → invalid (a sessão acabou)', async () => {
    const f = vi.fn(async () => ok({ message: 'Sessão expirada' }, 401));
    expect(await refreshSession('R1', { fetch: f as unknown as typeof fetch, apiUrl })).toEqual({ status: 'invalid' });
  });

  it('API fora do ar, 5xx ou timeout → unavailable, e NÃO fica guardado (a próxima tenta de novo)', async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce(ok({ message: 'ops' }, 503))
      .mockResolvedValueOnce(ok({ accessToken: 'A2', refreshToken: 'R2' }));
    const call = () => refreshSession('R1', { fetch: f as unknown as typeof fetch, apiUrl });
    expect(await call()).toEqual({ status: 'unavailable' });
    await Promise.resolve(); // deixa o .then de limpeza rodar
    expect(await call()).toEqual({ status: 'unavailable' });
    await Promise.resolve();
    expect(await call()).toMatchObject({ status: 'ok' });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('resposta 200 vazia ou sem os dois tokens nunca vira cookie (fresh não-vazio)', async () => {
    for (const body of [
      {},
      { accessToken: '', refreshToken: 'x' },
      { accessToken: 'x' },
      { accessToken: 1, refreshToken: 2 },
      null,
    ]) {
      resetRefreshSessionCache();
      const f = vi.fn(async () => ok(body));
      expect(await refreshSession('R1', { fetch: f as unknown as typeof fetch, apiUrl })).toEqual({
        status: 'unavailable',
      });
    }
  });
});
