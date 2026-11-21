// T2.5 · BFF da exportação LGPD: só atende a nossa própria página, exige sessão, repassa o arquivo e os erros da API.
import { describe, expect, it, vi } from 'vitest';
import { filenameFromDisposition, isSameOriginRequest, proxyExport } from './export-proxy';

const APP = 'https://app.tostao.exemplo.com.br';
const req = (headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  new Request(`${APP}/api/me/export`, { headers });

describe('isSameOriginRequest (anti-CSRF do GET que gasta cota)', () => {
  it('Sec-Fetch-Site: same-origin passa; cross-site, same-site e none não', () => {
    expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    for (const site of ['cross-site', 'same-site', 'none']) {
      expect(isSameOriginRequest(new Headers({ 'sec-fetch-site': site })), site).toBe(false);
    }
  });

  it('navegador antigo (sem Sec-Fetch-Site): vale o Referer do próprio site', () => {
    const h = (referer?: string) => new Headers({ host: 'app.tostao.exemplo.com.br', ...(referer ? { referer } : {}) });
    expect(isSameOriginRequest(h(`${APP}/perfil`))).toBe(true);
    expect(isSameOriginRequest(h('https://site-malicioso.example/pagina'))).toBe(false);
    expect(isSameOriginRequest(h())).toBe(false);
    expect(isSameOriginRequest(h('isso-nao-e-url'))).toBe(false);
  });
});

describe('filenameFromDisposition', () => {
  it('aceita só nome seguro; qualquer outra coisa cai no fallback', () => {
    expect(filenameFromDisposition('attachment; filename="tostao-meus-dados-2026-11-21.json"', 'x.json')).toBe(
      'tostao-meus-dados-2026-11-21.json',
    );
    expect(filenameFromDisposition('attachment; filename="../../etc/passwd"', 'x.json')).toBe('x.json');
    expect(filenameFromDisposition('attachment; filename="a b.json"', 'x.json')).toBe('x.json');
    expect(filenameFromDisposition(null, 'x.json')).toBe('x.json');
  });
});

describe('proxyExport', () => {
  const deps = (over: Partial<Parameters<typeof proxyExport>[1]> = {}) => ({
    getToken: async () => 'jwt-da-pessoa',
    apiUrl: 'http://api.interna:3333',
    appPublicUrl: APP,
    ...over,
  });

  it('pedido de outro site: 403 e a API nem é chamada', async () => {
    const fetchImpl = vi.fn();
    const res = await proxyExport(req({ 'sec-fetch-site': 'cross-site' }), deps({ fetchImpl }));
    expect(res.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sem sessão: 401 e a API nem é chamada', async () => {
    const fetchImpl = vi.fn();
    const res = await proxyExport(req(), deps({ getToken: async () => null, fetchImpl }));
    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('com sessão: chama GET /me/export com o Bearer e devolve o arquivo como download sem cache', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('{"profile":{"id":"u1"}}', {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'content-disposition': 'attachment; filename="tostao-meus-dados-2026-11-21.json"',
          },
        }),
    );
    const res = await proxyExport(
      req({ 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.9' }),
      deps({ fetchImpl }),
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.interna:3333/me/export');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer jwt-da-pessoa');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="tostao-meus-dados-2026-11-21.json"');
    expect(res.headers.get('cache-control')).toBe('no-store, private');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toBe('{"profile":{"id":"u1"}}');
  });

  it('o limite de 2 por dia (429) chega à tela com a mensagem da API', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Muitas tentativas. Tenta de novo daqui a 23 horas.' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const res = await proxyExport(req(), deps({ fetchImpl }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ message: 'Muitas tentativas. Tenta de novo daqui a 23 horas.' });
    expect(res.headers.get('content-disposition')).toBeNull();
  });

  it('API fora do ar: 502 com mensagem amigável (sem detalhe interno)', async () => {
    const fetchImpl = vi.fn(async () => Promise.reject(new TypeError('connect ECONNREFUSED 10.0.0.5:3333')));
    const res = await proxyExport(req(), deps({ fetchImpl }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });

  it('a route fina liga o proxy e só expõe GET', async () => {
    const mod = await import('../app/api/me/export/route');
    expect(typeof mod.GET).toBe('function');
    expect((mod as Record<string, unknown>).POST).toBeUndefined();
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
