// Service worker tuned to avoid stale HTML/chunk mismatches.
const CACHE_PREFIX = "governance-offline-v2";
const PAGE_CACHE = `${CACHE_PREFIX}-pages`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD4fhk-i2FR4lm6EWlz05Bypj8LRq7r_CA',
  authDomain: 'grp-gov-push.firebaseapp.com',
  projectId: 'grp-gov-push',
  storageBucket: 'grp-gov-push.appspot.com',
  messagingSenderId: '55096092431',
  appId: '1:55096092431:web:b58de51bbb7c3f3c0cc07a',
  measurementId: 'G-6CNWJLWFQK',
};

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

try {
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

  if (self.firebase && !self.firebase.apps.length) {
    self.firebase.initializeApp(FIREBASE_CONFIG);
  }

  if (self.firebase?.messaging) {
    const messaging = self.firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload?.notification?.title || 'Governance Update';
      const body = payload?.notification?.body || '';
      const icon = payload?.notification?.image || '/icons/icon-192x192.png';
      const link = payload?.data?.link || payload?.fcmOptions?.link || '/';

      self.registration.showNotification(title, {
        body,
        icon,
        data: { link },
      });
    });
  }
} catch (error) {
  console.warn('Firebase messaging service worker setup failed', error);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === link && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
      return undefined;
    })
  );
});

workbox.core.clientsClaim();

// Keep navigation documents fresh to prevent blank screen on deploy/chunk changes.
workbox.routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    cacheName: PAGE_CACHE,
    networkTimeoutSeconds: 4,
  })
);

// Cache static build assets.
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'worker',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: ASSET_CACHE,
  })
);

// Purge old cache versions after activation.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('governance-offline') && !key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key))
      )
    )
  );
});
