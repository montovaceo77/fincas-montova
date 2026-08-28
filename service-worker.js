// Service worker de Fincas Montova.
// Objetivo: que la app cargue rapido y tolere señal debil de finca.
// Solo controla el "cascaron" de la app (HTML, manifest, iconos) que
// vive en este mismo dominio. Las llamadas al backend en Google Apps
// Script (fincas-montova WS) siempre van directo a la red, nunca se
// cachean ni se interceptan aqui, para no servir datos viejos.

var CACHE_NAME = 'montova-cache-v1';

var CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Solo interceptamos peticiones GET de nuestro propio dominio.
  // Todo lo demas (POST, o cualquier llamada a script.google.com)
  // pasa directo a la red sin tocarlo.
  var isGet = req.method === 'GET';
  var isSameOrigin = new URL(req.url).origin === self.location.origin;
  if (!isGet || !isSameOrigin) {
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      var networkFetch = fetch(req)
        .then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(req, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return cached;
        });

      // Si ya tenemos una copia en cache, la mostramos de inmediato
      // (carga instantanea) y de fondo actualizamos con la red.
      return cached || networkFetch;
    })
  );
});
