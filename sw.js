const V = 'pianoflow-v11';
const FILES = ['./', 'index.html', 'app.js', 'parsers.js', 'songs.js', 'curriculum.js', 'learn.js', 'placement.js', 'mic.js', 'style.css', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== 'share').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// réseau d'abord (pour recevoir les mises à jour), cache en secours (hors ligne)
self.addEventListener('fetch', e => {
  if (e.request.method === 'POST' && new URL(e.request.url).pathname.endsWith('/share')) {
    e.respondWith((async () => {
      const fd = await e.request.formData(), c = await caches.open('share');
      await Promise.all(fd.getAll('score').map((f, i) => c.put(self.registration.scope + 'shared/' + i + '/' + encodeURIComponent(f.name), new Response(f))));
      return Response.redirect(self.registration.scope + '?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(ch => ch.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
