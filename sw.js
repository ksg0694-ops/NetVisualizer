const CACHE_NAME = 'smartbook-v2-app-cache-v187';
importScripts('./offline-assets.js');
const cacheId = CACHE_NAME + '-' + self.NETVISUALIZER_OFFLINE.revision;
const urlsToCache = self.NETVISUALIZER_OFFLINE.assets;
const scopeUrl = new URL('./', self.location.href);
const required = new Set(urlsToCache.map(path => new URL(path, scopeUrl).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheId).then(cache => cache.addAll(urlsToCache)));
  // A waiting update activates after existing tabs close, preserving live edits.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('smartbook-v2-app-cache-') && key !== cacheId)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  const isShell = required.has(url.href);
  const lazy = url.pathname.startsWith(scopeUrl.pathname + 'vendor/') || url.pathname.startsWith(scopeUrl.pathname + 'img/');
  if (!isShell && !lazy) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheId);
    const hit = await cache.match(event.request);
    if (hit) return hit;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(event.request, response.clone());
    return response;
  })());
});
