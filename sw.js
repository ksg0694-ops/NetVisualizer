const CACHE_NAME = 'smartbook-v2-app-cache-v5';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './js/features/assetTrend.js',
  './img/cards/s_choice.png'
];

// 설치 시 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// 활성화 시 이전 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 네트워크 요청 가로채기 (Network First, fallback to Cache)
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // API 요청은 캐싱하지 않고 무조건 네트워크로 보냄
  if (
    requestUrl.hostname.endsWith('supabase.co') ||
    event.request.url.includes('script.google.com') ||
    event.request.method !== 'GET'
  ) {
    return; 
  }

  // HTML이나 정적 파일은 네트워크 먼저 시도 후, 실패 시 캐시 반환
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
