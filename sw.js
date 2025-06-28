// sw.js - Service Worker for Bitcoin DCA Accumulator

const CACHE_NAME = 'bitcoin-dca-cache-v1';
const OFFLINE_URL = 'offline.html';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6.2.1/dist/idb-keyval.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Segoe+UI:wght@400;500;600&display=swap'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(PRECACHE_URLS)
          .then(() => cache.add(OFFLINE_URL));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle API requests
  if (event.request.url.includes('api.binance.com') || 
      event.request.url.includes('api.coingecko.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the API response
          const clone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Return cached response if available
          return caches.match(event.request);
        })
    );
    return;
  }

  // For all other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
          .catch(() => {
            // If offline and page doesn't exist in cache, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Background sync event
self.addEventListener('sync', event => {
  if (event.tag === 'price-update') {
    event.waitUntil(
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
        .then(response => response.json())
        .then(priceData => {
          // Send the price data to all clients
          self.clients.matchAll()
            .then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'price-update',
                  price: priceData.price
                });
              });
            });
        })
        .catch(err => {
          console.log('Background sync failed:', err);
        })
    );
  }
});

// Push notification event (optional)
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'icons/icon-192x192.png',
    badge: 'icons/badge-72x72.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event (optional)
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
