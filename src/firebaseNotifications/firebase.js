import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APPID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
);

const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;

const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
let messagingPromise;
async function getMessagingClient() {
  if (!firebaseApp || typeof window === 'undefined') return null;
  if (!messagingPromise) {
    messagingPromise = isSupported().then(supported => supported ? getMessaging(firebaseApp) : null).catch(() => null);
  }
  return messagingPromise;
}

async function getMessagingServiceWorkerRegistration() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return undefined;
  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn('Failed to load service worker registration for FCM', error);
    return undefined;
  }
}

export const fetchToken = async (setTokenFound) => {
  try {
    const messaging = await getMessagingClient();
    if (!messaging || !vapidKey) {
      if (typeof setTokenFound === 'function') setTokenFound(false);
      console.warn('Firebase messaging is not configured. Missing Firebase config or VAPID key.');
      return null;
    }

    const serviceWorkerRegistration = await getMessagingServiceWorkerRegistration();
    const currentToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    const found = !!currentToken;
    if (typeof setTokenFound === 'function') setTokenFound(found);

    if (!currentToken) {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }

    return currentToken;
  } catch (err) {
    console.log('An error occurred while retrieving token.', err);
    if (typeof setTokenFound === 'function') setTokenFound(false);
    return null;
  }
};

export const onMessageListener = async () => {
  const messaging = await getMessagingClient();
  if (!messaging) throw new Error('Firebase messaging is unavailable in this browser.');
  return new Promise(resolve => onMessage(messaging, resolve));
};

export const listenForForegroundMessages = async (handler) => {
  const messaging = await getMessagingClient();
  if (!messaging) return () => {};
  return onMessage(messaging, payload => {
    if (typeof handler === 'function') handler(payload);
  });
};
