// Service worker do Tostão: avisos no celular (Web Push) e uma página "sem internet" pra navegação offline.
//
// Segurança do offline: o ÚNICO recurso guardado é a página estática /offline (sem dado de ninguém). Respostas da API,
// HTML de rotas logadas e qualquer outra coisa NUNCA entram no cache: num aparelho compartilhado, o extrato de uma
// pessoa não pode ficar disponível pra outra. Por isso não há cache de runtime, só esse pré-cache fixo.
const OFFLINE_CACHE = 'tostao-offline-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch(OFFLINE_URL, { credentials: 'omit', cache: 'reload' });
        // Só guarda resposta 200 de verdade (nada de redirect pro login ou página de erro).
        if (res.ok && !res.redirected) await (await caches.open(OFFLINE_CACHE)).put(OFFLINE_URL, res);
      } catch {
        /* sem rede na instalação: o app funciona igual, só não terá a página offline até a próxima versão do SW */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== OFFLINE_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  ),
);

// Só navegação (o usuário abrindo/recarregando uma página). Tenta a rede; se ela falhar (offline), mostra /offline.
// Requisições de API, imagens, scripts e Server Actions não passam por aqui (o navegador cuida delas).
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
      return cached ?? Response.error();
    }),
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Tostão', body: '', url: '/inicio' };
  try { data = { ...data, ...event.data.json() }; } catch { /* aviso sem corpo */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icones/icon-192.png',
    badge: '/icones/icon-192.png',
    tag: data.tag,
    data: { url: data.url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // data.url vem do payload do push: só abre se for da nossa origem (nunca uma URL externa).
  const raw = event.notification.data?.url ?? '/inicio';
  let parsed;
  try {
    parsed = new URL(raw, self.location.origin);
  } catch {
    parsed = null;
  }
  const url =
    parsed && parsed.origin === self.location.origin ? parsed.href : new URL('/inicio', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(self.location.origin));
    if (open) { await open.focus(); return open.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
