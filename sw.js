// sw.js
self.addEventListener('sync', (event) => {
  if (event.tag === 'price-update') {
    event.waitUntil(
      fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
        .then(response => response.json())
        .then(priceData => {
          // You could send this back to the page via postMessage
          console.log('Background sync fetched price:', priceData);
        })
    );
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
