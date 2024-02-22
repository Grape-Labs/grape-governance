import { Workbox } from 'workbox-window';

const wb = new Workbox('my-service-worker');

// Precache static assets
wb.precache([
  '/realtime',
  '/directory',
]);

// Cache API routes
wb.router.registerRoute(/\.(gif|jpg|png)/, 'CacheFirst');

// Catch requests that might fail
wb.router.setDefaultHandler(({ request }) => {
  return [
    // Try to serve from the network.
    fetchRequest(request),
    // If that fails, serve from the cache.
    respondWithCache(),
  ];
});

// Activate the service worker
wb.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Register the service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/serviceWorker.js').then(() => {
    console.log('Service worker registered!');
  }).catch((error) => {
    console.error('Service worker registration failed:', error);
  });
}