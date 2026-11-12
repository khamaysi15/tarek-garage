// מוסך טארק – עבודה גם בלי אינטרנט
const V = 'tarek-v3';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-180.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network first so updates arrive; cache when offline
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(req, c)); return res; })));
  }
});
