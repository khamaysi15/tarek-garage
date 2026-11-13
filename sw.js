// מוסך טארק – עבודה גם בלי אינטרנט
const V = 'tarek-v5';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-180.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network first so updates arrive; cache when offline
    // always ask the server for the newest version (skip the browser's HTTP cache); fall back to the copy when offline
    const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(new Request(req, { cache: 'no-cache' }));
    e.respondWith(fresh.then(res => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); return res; })));
  }
});

// food-order reminders
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'מוסך טארק', {
    body: d.body || '', icon: 'icon-180.png', badge: 'icon-180.png', tag: d.tag || 'garage', renotify: true, lang: 'he', dir: 'rtl',
    data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ('focus' in c) { c.navigate && c.navigate(url); return c.focus(); }
    return clients.openWindow(url);
  }));
});
