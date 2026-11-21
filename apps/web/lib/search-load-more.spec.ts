// T2.2 · "Carregar mais" da busca: a Server Action valida o que chega (é um endpoint público), chama a API com o
// cursor e devolve só a página; erro vira mensagem, e o redirect de sessão vencida passa intacto.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRedirectError } from 'next/dist/client/components/redirect-error';

vi.mock('@/lib/session', () => ({ getToken: async () => 'jwt' }));

import { loadMoreSearch } from '../app/(app)/carteira/busca/actions';

const base = { q: 'dani', period: '12m', kind: 'todas', excludeTransfers: false, excludeYields: false, cursor: 'CUR' };
const respond = (status: number, body: unknown = {}) =>
  vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
const calledUrl = (f: ReturnType<typeof respond>) => new URL(String(f.mock.calls[0]![0]));

beforeEach(() => vi.unstubAllGlobals());

describe('loadMoreSearch()', () => {
  it('manda filtros + cursor + limit pra API e devolve só a página e o próximo cursor', async () => {
    const f = respond(200, { transactions: [{ id: 't1' }], count: 9, outInCents: 1, inInCents: 2, nextCursor: 'NEXT' });
    vi.stubGlobal('fetch', f);
    const r = await loadMoreSearch({ ...base, excludeTransfers: true });
    expect(r).toEqual({ transactions: [{ id: 't1' }], nextCursor: 'NEXT' });
    const u = calledUrl(f);
    expect(u.pathname).toBe('/transactions/search');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      q: 'dani',
      period: '12m',
      kind: 'todas',
      cursor: 'CUR',
      limit: '50',
      excludeTransfers: '1',
    });
  });

  it('acabou a lista: nextCursor null', async () => {
    vi.stubGlobal('fetch', respond(200, { transactions: [], count: 0, outInCents: 0, inInCents: 0, nextCursor: null }));
    expect(await loadMoreSearch(base)).toEqual({ transactions: [], nextCursor: null });
  });

  it('entrada inválida (período inventado, sem cursor, texto enorme) nem chega na API', async () => {
    const f = respond(200);
    vi.stubGlobal('fetch', f);
    for (const bad of [
      { ...base, period: 'sempre' },
      { ...base, kind: 'tudo' },
      { ...base, cursor: '' },
      { ...base, q: 'x'.repeat(500) },
    ])
      expect(await loadMoreSearch(bad)).toEqual({ error: 'invalid' });
    expect(f).not.toHaveBeenCalled();
  });

  it('cursor inválido na API (400) vira a mensagem dela; erro de rede vira "error"', async () => {
    vi.stubGlobal('fetch', respond(400, { message: 'Esse "carregar mais" não vale mais.' }));
    expect(await loadMoreSearch(base)).toEqual({ error: 'Esse "carregar mais" não vale mais.' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fetch failed'))),
    );
    expect(await loadMoreSearch(base)).toMatchObject({ error: expect.any(String) });
  });

  it('sessão vencida (401): o NEXT_REDIRECT sobe, não vira { error }', async () => {
    vi.stubGlobal('fetch', respond(401, { message: 'x' }));
    const err = await loadMoreSearch(base).catch((e) => e);
    expect(isRedirectError(err)).toBe(true);
  });
});
