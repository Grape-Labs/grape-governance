// Service worker tuned to avoid stale HTML/chunk mismatches.
const CACHE_PREFIX = "governance-offline-v2";
const PAGE_CACHE = `${CACHE_PREFIX}-pages`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets`;

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APPID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

function hasFirebaseConfig(config) {
  return Boolean(
    config &&
      config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId
  );
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

try {
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

  if (self.firebase && !self.firebase.apps.length && hasFirebaseConfig(FIREBASE_CONFIG)) {
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
