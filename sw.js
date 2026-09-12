/* ============================================================
   LeKhuBo Connect — Service Worker
   Offline support via app-shell caching.
   Strategy:
     - Navigations (HTML): network-first, fall back to cache, then offline page.
     - Static assets (css/js/svg): cache-first, update in background.
   Bump CACHE_VERSION whenever you change cached files to force an update.
   ============================================================ */
'use strict';

var CACHE_VERSION = 'lekhubo-v8';
var CACHE_NAME = 'lekhubo-cache-' + CACHE_VERSION;

// Paths are relative so the SW works whether the site is served from
// the domain root or a sub-path (e.g. /lebokhu-group/ on GitHub Pages).
var PRECACHE_URLS = [
  './',
  './index.html',
  './jobs.html',
  './register.html',
  './css/styles.css',
  './js/main.js',
  './js/jobs.js',
  './js/register.js',
  './assets/logo.svg',
  './assets/logo-white.svg',
  './assets/favicon.svg',
  './assets/icon-192.svg',
  './assets/icon-512.svg',
  './assets/icon-maskable.svg',
  './manifest.webmanifest'
];

// ---- Install: pre-cache the app shell ----
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll fails the whole install if one URL 404s; add individually to be resilient.
      return Promise.all(PRECACHE_URLS.map(function (url) {
        return cache.add(url).catch(function () { /* ignore individual failures */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// ---- Fetch ----
self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Don't cache cross-origin requests (e.g. Formspree submissions, fonts CDNs)
  var sameOrigin = new URL(req.url).origin === self.location.origin;
  if (!sameOrigin) return;

  // Network-first for page navigations
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Code (JS/CSS/JSON): NETWORK-FIRST so updates load immediately when online,
  // falling back to cache when offline. Prevents stale code being served.
  var path = new URL(req.url).pathname;
  if (/\.(js|css|json|webmanifest)$/i.test(path)) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  // Everything else (images/svg/fonts): cache-first, refresh in background.
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
