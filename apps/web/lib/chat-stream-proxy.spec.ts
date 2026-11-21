import { describe, expect, it, vi } from 'vitest';
import { isTrustedOrigin, proxyChatStream } from './chat-stream-proxy';

const SITE = 'https://app.exemplo.test';
const req = (init: { headers?: Record<string, string>; body?: unknown; signal?: AbortSignal } = {}) =>
  new Request(`${SITE}/api/chat/stream`, {
    method: 'POST',
    headers: { origin: SITE, host: 'app.exemplo.test', 'content-type': 'application/json', ...init.headers },
    body: init.body === undefined ? JSON.stringify({ message: 'oi' }) : JSON.stringify(init.body),
    signal: init.signal,
  });

const sse = (text = 'data: {"type":"status","text":"x"}\n\n') =>
  new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
const deps = (fetchImpl: typeof fetch, token: string | null = 'jwt-da-pessoa') => ({
  getToken: async () => token,
  apiUrl: 'http://api.interna:3333',
  fetchImpl,
});

describe('isTrustedOrigin (anti-CSRF)', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it('aceita o próprio site (Host ou X-Forwarded-Host) e rejeita o resto', () => {
    expect(isTrustedOrigin(h({ origin: SITE, host: 'app.exemplo.test' }))).toBe(true);
    expect(isTrustedOrigin(h({ origin: SITE, host: 'localhost:3000', 'x-forwarded-host': 'app.exemplo.test' }))).toBe(
      true,
    );
    expect(isTrustedOrigin(h({ origin: 'https://malicioso.test', host: 'app.exemplo.test' }))).toBe(false);
    expect(isTrustedOrigin(h({ host: 'app.exemplo.test' }))).toBe(false); // sem Origin
    expect(isTrustedOrigin(h({ origin: 'null', host: 'app.exemplo.test' }))).toBe(false);
    expect(isTrustedOrigin(h({ origin: 'lixo', host: 'app.exemplo.test' }))).toBe(false);
  });
  it('atrás de um proxy reverso (Host interno): vale a APP_PUBLIC_URL', () => {
    const headers = h({ origin: SITE, host: 'localhost:3000' });
    expect(isTrustedOrigin(headers)).toBe(false);
    expect(isTrustedOrigin(headers, SITE)).toBe(true);
    expect(isTrustedOrigin(h({ origin: 'https://malicioso.test', host: 'localhost:3000' }), SITE)).toBe(false);
  });
});

describe('proxyChatStream', () => {
  it('repassa com o token no cabeçalho e devolve o SSE sem cache nem buffer', async () => {
    const f = vi.fn(async () => sse());
    const res = await proxyChatStream(
      req({ headers: { 'x-forwarded-for': '203.0.113.7' } }),
      deps(f as unknown as typeof fetch),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-cache');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    expect(await res.text()).toContain('"type":"status"');

    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.interna:3333/chat/stream');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer jwt-da-pessoa');
    expect(headers['x-forwarded-for']).toBe('203.0.113.7'); // o limite por IP da API enxerga a pessoa, não o Next
    expect(JSON.parse(init.body as string)).toEqual({ message: 'oi' });
  });

  it('sem token: 401 e a API nem é chamada', async () => {
    const f = vi.fn();
    const res = await proxyChatStream(req(), deps(f as unknown as typeof fetch, null));
    expect(res.status).toBe(401);
    expect(f).not.toHaveBeenCalled();
  });

  it('origem errada: 403; sem JSON no content-type: 415; nenhum chega na API', async () => {
    const f = vi.fn();
    const d = deps(f as unknown as typeof fetch);
    expect((await proxyChatStream(req({ headers: { origin: 'https://malicioso.test' } }), d)).status).toBe(403);
    expect((await proxyChatStream(req({ headers: { 'content-type': 'text/plain' } }), d)).status).toBe(415);
    expect(f).not.toHaveBeenCalled();
  });

  it('corpo inválido: 400 com a mensagem, sem chamar a API', async () => {
    const f = vi.fn();
    const d = deps(f as unknown as typeof fetch);
    for (const body of [{ message: '   ' }, { message: 'x'.repeat(1001) }, {}, 'texto']) {
      expect((await proxyChatStream(req({ body }), d)).status).toBe(400);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('erro da API (403 sem aceite de IA) passa com o mesmo status e corpo, pra tela mostrar o aviso', async () => {
    const f = async () =>
      new Response(JSON.stringify({ message: 'Aceite', code: 'AI_CONSENT_REQUIRED' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    const res = await proxyChatStream(req(), deps(f as unknown as typeof fetch));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: 'Aceite', code: 'AI_CONSENT_REQUIRED' });
  });

  it('API fora do ar: 502 (o cliente cai no caminho normal); 200 que não é SSE também vira 502', async () => {
    const down = async () => {
      throw new TypeError('ECONNREFUSED');
    };
    expect((await proxyChatStream(req(), deps(down as unknown as typeof fetch))).status).toBe(502);
    const html = async () => new Response('<html/>', { status: 200, headers: { 'content-type': 'text/html' } });
    expect((await proxyChatStream(req(), deps(html as unknown as typeof fetch))).status).toBe(502);
  });

  it('repassa o cancelamento: aba fechada derruba a chamada à API', async () => {
    const ctl = new AbortController();
    let received: AbortSignal | undefined;
    const f = vi.fn(async (_u: string, init: RequestInit) => {
      received = init.signal as AbortSignal;
      return sse();
    });
    await proxyChatStream(req({ signal: ctl.signal }), deps(f as unknown as typeof fetch));
    ctl.abort();
    expect(received?.aborted).toBe(true);
  });
});
