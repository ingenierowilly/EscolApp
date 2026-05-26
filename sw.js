// EscolApp - Service Worker v1.0
// Pollitos Apps 2026

const CACHE_NAME = 'escolapp-v1';
const OFFLINE_URL = 'offline.html';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap',
];

// Instalación — pre-cachear recursos principales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.log('SW: algunos recursos no se pudieron cachear', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activación — limpiar caches viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first para assets, network first para datos
self.addEventListener('fetch', event => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  // Ignorar peticiones a APIs externas (Firebase, Gemini, Gmail)
  const url = new URL(event.request.url);
  const isExternal = [
    'firebaseio.com', 'firestore.googleapis.com',
    'googleapis.com', 'generativelanguage.googleapis.com',
    'fonts.gstatic.com'
  ].some(domain => url.hostname.includes(domain));

  if (isExternal && !url.hostname.includes('fonts.googleapis.com')) {
    // Para APIs externas: solo network, sin cache
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Cachear respuestas válidas de nuestro origen
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin conexión y sin cache → página offline
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL) || caches.match('/index.html');
        }
      });
    })
  );
});

// Notificaciones push
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'EscolApp 🎒';
  const options = {
    body: data.body || 'Tienes nuevas tareas pendientes',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ver tablero' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
  }
});
