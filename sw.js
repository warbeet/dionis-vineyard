// Service Worker для PWA «Dionis vineyard» v2 (модульная архитектура)
const CACHE_NAME = 'dionis-v0.6.9';
const RUNTIME_CACHE = 'dionis-runtime-v0.6.9';

// Предзагрузка ключевых ресурсов
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './version.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
  './icons/favicon.ico',
  './icons/apple-touch-icon.png',
  './assets/logo-mark-header.png',
  './assets/logo-full-transparent.png',
  // CSS
  './css/core.css',
  './css/layout.css',
  './css/components.css',
  './css/plots.css',
  './css/weather.css',
  './css/photo.css',
  './css/auth.css',
  // JS
  './js/data.js',
  './js/version.js',
  './js/utils.js',
  './js/ui.js',
  './js/storage.js',
  './js/sync-v2.js',
  './js/auth.js',
  './js/team.js',
  './js/permissions.js',
  './js/settings.js',
  './js/locale.js',
  './js/ai.js',
  './js/weather.js',
  './js/stations.js',
  './js/plot-geometry.js',
  './js/rows-editor.js',
  './js/block-zone.js',
  './js/irrigation.js',
  './js/plot-tools.js',
  './js/map-drawing.js',
  './js/plot-menu.js',
  './js/maps-yandex.js',
  './js/plots.js',
  './js/photos.js',
  './js/journal.js',
  './js/treatments.js',
  './js/spray-plan.js',
  './js/plan.js',
  './js/harvest.js',
  './js/recommendations.js',
  './js/reports.js',
  './js/dashboard.js',
  './js/app.js',
  // Секции
  './sections/dashboard.html',
  './sections/plots.html',
  './sections/photos.html',
  './sections/journal.html',
  './sections/weather.html',
  './sections/treatments.html',
  './sections/plan.html',
  './sections/recommendations.html',
  './sections/harvest.html',
  './sections/reports.html',
  './sections/team.html',
  './sections/settings.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Precache partial fail:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('open-meteo.com') ||
    url.hostname.includes('geocoding-api') ||
    url.hostname.includes('api.weather.yandex') ||
    url.hostname.includes('api-maps.yandex.ru') ||
    url.hostname.includes('oauth.yandex.ru') ||
    url.hostname.includes('login.yandex.ru') ||
    url.hostname.includes('avatars.yandex.net') ||
    url.hostname.includes('yandex.net') ||
    url.hostname.includes('maps.yandex')
  ) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Dionis vineyard', body: 'Новое уведомление' };
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
