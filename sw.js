/* MA SANTÉ — Service worker : rend le site installable et affiche la dernière version connue hors connexion.
   Stratégie "réseau d'abord" : les mises à jour du site sont toujours prises en compte.
   Les appels à l'API (Google) ne sont jamais mis en cache. */
const CACHE = 'ma-sante-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/google(usercontent)?\.com$/.test(url.hostname) && url.hostname.startsWith('script.')) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && (url.origin === location.origin || /cdnjs|jsdelivr|gstatic|googleapis/.test(url.hostname))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
