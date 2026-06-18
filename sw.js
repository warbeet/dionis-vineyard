// Service Worker для PWA «Виноградник»
const CACHE_NAME = 'dionis-v1.3.0';
const RUNTIME_CACHE = 'dionis-runtime-v2';

// Файлы для предзагрузки (App Shell)
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
  './icons/favicon.ico',
  './icons/apple-touch-icon.png',
  './assets/logo-mark-header.png',
  './assets/logo-full-transparent.png'
];

// Установка
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Precache partial fail:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// Активация — чистим старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Стратегия:
// - для API (firebase, openrouter, open-meteo) — network only (или network-first без кэша критичных вещей)
// - для App Shell — cache first
// - для остального — network falling back to cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Не кэшируем POST и не-GET
  if (event.request.method !== 'GET') return;

  // API — всегда сеть
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('geocoding-api')
  ) {
    return;
  }

  // App shell — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Кэшируем только успешные базовые ответы
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Оффлайн — возвращаем index.html для навигации
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Push-уведомления (на будущее)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Виноградник', body: 'Новое уведомление' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [100, 50, 100]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
