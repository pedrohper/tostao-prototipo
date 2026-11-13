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
  const url = new URL(event.notification.data?.url ?? '/inicio', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(self.location.origin));
    if (open) { await open.focus(); return open.navigate(url); }
    return self.clients.openWindow(url);
  })());
});
