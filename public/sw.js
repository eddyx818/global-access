const CACHE = 'global-access-v6';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['/manifest.json', '/icon.svg']))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isAppShell = event.request.mode === 'navigate'
    || url.pathname === '/'
    || url.pathname === '/index.html';

  if (isAppShell) {
    // Always fetch fresh HTML — stale cache caused blank/broken loads in normal browser tabs.
    event.respondWith(
      fetch(event.request)
        .then((res) => (res.ok ? res : caches.match('/index.html').then((c) => c || res)))
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok && url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|webp)$/)) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Global Access', body: 'New message', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'Global Access', {
      body: data.body || 'New message',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: data.conversationId ? `ga-chat-${data.conversationId}` : 'ga-chat',
      renotify: true,
      data: { url: data.url || '/', conversationId: data.conversationId || null },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_CHAT', conversationId: event.notification.data?.conversationId });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
