const CACHE_NAME = 'lsk-b2-cache-v4.2';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/storage.js',
  './js/api.js',
  './js/app.js',
  './data/cards.json',
  './data/tasks.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-First Strategy: Immer neueste GitHub-Version laden, Offline als Fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(networkRes => {
        const resClone = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return networkRes;
      })
      .catch(() => caches.match(event.request))
  );
});