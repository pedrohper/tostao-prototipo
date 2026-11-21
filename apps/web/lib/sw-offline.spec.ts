// T2.4 · service worker offline SEGURO: só a página /offline é guardada; API e rotas logadas nunca entram no cache.
// Roda o public/sw.js de verdade num contexto `vm` com um `self`/`caches`/`fetch` de mentira.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');

type Listener = (event: Record<string, unknown>) => void;

function load({
  fetchImpl,
  cachedOffline,
}: {
  fetchImpl: (...a: unknown[]) => Promise<unknown>;
  cachedOffline?: unknown;
}) {
  const listeners: Record<string, Listener> = {};
  const puts: { cache: string; url: string; res: unknown }[] = [];
  const deleted: string[] = [];
  const fetchMock = vi.fn(fetchImpl);
  const self = {
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => []), openWindow: vi.fn() },
    location: { origin: 'https://app.exemplo.com.br' },
    registration: { showNotification: vi.fn() },
  };
  const caches = {
    open: async (name: string) => ({
      put: async (url: string, res: unknown) => void puts.push({ cache: name, url, res }),
    }),
    keys: async () => ['tostao-offline-v1', 'cache-antigo', 'next-data'],
    delete: async (name: string) => {
      deleted.push(name);
      return true;
    },
    match: vi.fn(async () => cachedOffline),
  };
  const context = vm.createContext({
    self,
    caches,
    fetch: fetchMock,
    Response: { error: () => 'NETWORK_ERROR' },
    URL,
    console,
  });
  vm.runInContext(source, context);
  return { listeners, puts, deleted, fetchMock, caches, self };
}

function dispatch(listener: Listener, extra: Record<string, unknown>) {
  const out: { responded?: Promise<unknown>; waited?: Promise<unknown> } = {};
  listener({
    ...extra,
    respondWith: (p: Promise<unknown>) => (out.responded = p),
    waitUntil: (p: Promise<unknown>) => (out.waited = p),
  });
  return out;
}

const okRes = { ok: true, redirected: false, tag: 'offline-html' };

describe('sw.js · instalação', () => {
  it('pré-cacheia só /offline, sem credenciais', async () => {
    const sw = load({ fetchImpl: async () => okRes });
    await dispatch(sw.listeners.install!, {}).waited;
    expect(sw.fetchMock).toHaveBeenCalledOnce();
    expect(sw.fetchMock.mock.calls[0]![0]).toBe('/offline');
    expect((sw.fetchMock.mock.calls[0]![1] as { credentials: string }).credentials).toBe('omit');
    expect(sw.puts).toEqual([{ cache: 'tostao-offline-v1', url: '/offline', res: okRes }]);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('não guarda resposta com erro nem redirect (ex.: cair no login)', async () => {
    for (const bad of [
      { ok: false, redirected: false },
      { ok: true, redirected: true },
    ]) {
      const sw = load({ fetchImpl: async () => bad });
      await dispatch(sw.listeners.install!, {}).waited;
      expect(sw.puts).toEqual([]);
    }
  });

  it('sem rede na instalação, não quebra', async () => {
    const sw = load({ fetchImpl: async () => Promise.reject(new TypeError('offline')) });
    await expect(dispatch(sw.listeners.install!, {}).waited).resolves.toBeUndefined();
  });

  it('ao ativar, apaga qualquer cache que não seja o /offline', async () => {
    const sw = load({ fetchImpl: async () => okRes });
    await dispatch(sw.listeners.activate!, {}).waited;
    expect(sw.deleted.sort()).toEqual(['cache-antigo', 'next-data']);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });
});

describe('sw.js · navegação', () => {
  const navigate = { mode: 'navigate', method: 'GET', url: 'https://app.exemplo.com.br/carteira' };

  it('online: devolve o que a rede respondeu (nada vem do cache)', async () => {
    const network = { tag: 'rede' };
    const sw = load({ fetchImpl: async () => network, cachedOffline: { tag: 'offline' } });
    const out = dispatch(sw.listeners.fetch!, { request: navigate });
    await expect(out.responded).resolves.toBe(network);
    expect(sw.caches.match).not.toHaveBeenCalled();
  });

  it('offline: mostra a página /offline pré-cacheada', async () => {
    const offline = { tag: 'offline' };
    const sw = load({
      fetchImpl: async () => Promise.reject(new TypeError('Failed to fetch')),
      cachedOffline: offline,
    });
    const out = dispatch(sw.listeners.fetch!, { request: navigate });
    await expect(out.responded).resolves.toBe(offline);
    expect(sw.caches.match).toHaveBeenCalledWith('/offline', { cacheName: 'tostao-offline-v1' });
  });

  it('offline sem página guardada: erro de rede normal do navegador', async () => {
    const sw = load({ fetchImpl: async () => Promise.reject(new TypeError('x')), cachedOffline: undefined });
    await expect(dispatch(sw.listeners.fetch!, { request: navigate }).responded).resolves.toBe('NETWORK_ERROR');
  });

  it.each([
    ['chamada de API (fetch/XHR)', { mode: 'cors', method: 'GET', url: 'https://app.exemplo.com.br/api/chat/stream' }],
    [
      'imagem/script (no-cors)',
      { mode: 'no-cors', method: 'GET', url: 'https://app.exemplo.com.br/elenco/tostao.webp' },
    ],
    [
      'envio de formulário (POST de navegação)',
      { mode: 'navigate', method: 'POST', url: 'https://app.exemplo.com.br/entrar' },
    ],
  ])('não intercepta: %s', (_n, request) => {
    const sw = load({ fetchImpl: async () => okRes });
    const out = dispatch(sw.listeners.fetch!, { request });
    expect(out.responded).toBeUndefined();
  });
});

describe('sw.js · o que NUNCA é cacheado (leitura do código)', () => {
  it('só existe um cache.put, só do OFFLINE_URL, e nenhum addAll/cache de runtime', () => {
    expect(source.match(/\.put\(/g)).toHaveLength(1);
    expect(source).toContain('.put(OFFLINE_URL');
    expect(source).not.toContain('addAll');
    expect(source).not.toMatch(/['"`]\/api\//);
    expect(source).not.toMatch(/\(app\)/);
  });

  it('o push continua funcionando (regressão da Fase 0: só abre URL da mesma origem)', () => {
    expect(source).toContain("self.addEventListener('push'");
    expect(source).toContain('parsed.origin === self.location.origin');
  });
});
