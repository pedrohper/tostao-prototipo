// T5.3 · BFF do webhook dos Atalhos: só repassa token bem formado, JSON pequeno, e nunca cookie.
import { describe, expect, it, vi } from 'vitest';
import { proxyShortcuts } from './shortcuts-proxy';

const TOKEN = `tst_${'a'.repeat(43)}`;
const req = (over: { headers?: Record<string, string>; body?: string } = {}) =>
  new Request('https://tostao.exemplo.com/api/webhooks/shortcuts', {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...over.headers },
    body: over.body ?? JSON.stringify({ source: 'apple_pay', amount: 10 }),
  });
const upstream = (status = 201, body: unknown = { id: 'x', duplicate: false }, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers }));

describe('proxyShortcuts', () => {
  it('repassa o corpo e o Bearer pra API, com o IP real; devolve status e JSON', async () => {
    const f = upstream();
    const r = await proxyShortcuts(req({ headers: { 'x-forwarded-for': '1.1.1.1, 200.1.2.3' } }), {
      apiUrl: 'http://api:3333',
      fetchImpl: f as never,
    });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: 'x', duplicate: false });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api:3333/webhooks/shortcuts');
    const h = init.headers as Record<string, string>;
    expect(h.authorization).toBe(`Bearer ${TOKEN}`);
    expect(h['x-forwarded-for']).toBe('200.1.2.3'); // o ÚLTIMO item: o que o proxy reverso acrescentou
    expect(JSON.parse(init.body as string)).toEqual({ source: 'apple_pay', amount: 10 });
  });

  it('NUNCA repassa cookie nem outros cabeçalhos do cliente', async () => {
    const f = upstream();
    await proxyShortcuts(req({ headers: { cookie: 'tostao_token=segredo', 'x-custom': 'z' } }), {
      apiUrl: 'http://api',
      fetchImpl: f as never,
    });
    const h = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(Object.keys(h).sort()).toEqual(['authorization', 'content-type']);
  });

  it('token malformado/ausente: 401 sem nem chamar a API', async () => {
    const f = upstream();
    for (const authorization of ['', 'Bearer abc', `Bearer ${TOKEN}x y`, `Basic ${TOKEN}`, 'Bearer tst_curto']) {
      const r = await proxyShortcuts(req({ headers: { authorization } }), {
        apiUrl: 'http://api',
        fetchImpl: f as never,
      });
      expect(r.status, authorization).toBe(401);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('não-JSON: 415; corpo > 16 KB: 413 (sem chamar a API)', async () => {
    const f = upstream();
    expect(
      (
        await proxyShortcuts(req({ headers: { 'content-type': 'text/plain' } }), {
          apiUrl: 'http://api',
          fetchImpl: f as never,
        })
      ).status,
    ).toBe(415);
    expect(
      (
        await proxyShortcuts(req({ body: JSON.stringify({ text: 'x'.repeat(20_000) }) }), {
          apiUrl: 'http://api',
          fetchImpl: f as never,
        })
      ).status,
    ).toBe(413);
    expect(f).not.toHaveBeenCalled();
  });

  it('erros da API passam como vieram (401, 400, 429 com Retry-After); API fora do ar vira 503 limpo', async () => {
    const limited = await proxyShortcuts(req(), {
      apiUrl: 'http://api',
      fetchImpl: upstream(429, { message: 'Muitas tentativas.' }, { 'retry-after': '30' }) as never,
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('30');
    expect(
      (
        await proxyShortcuts(req(), {
          apiUrl: 'http://api',
          fetchImpl: upstream(401, { message: 'Token inválido.' }) as never,
        })
      ).status,
    ).toBe(401);
    const down = await proxyShortcuts(req(), {
      apiUrl: 'http://api',
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as never,
    });
    expect(down.status).toBe(503);
    expect(JSON.stringify(await down.json())).not.toMatch(/ECONNREFUSED/);
  });
});
