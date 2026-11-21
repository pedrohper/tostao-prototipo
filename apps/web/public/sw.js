// Service worker do Tostão: só cuida dos avisos no celular (Web Push).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
