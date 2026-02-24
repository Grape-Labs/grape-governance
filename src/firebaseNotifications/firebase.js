import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { VAPID_KEY } from '../utils/grapeTools/constants';

const firebaseConfig = {
  apiKey: 'AIzaSyD4fhk-i2FR4lm6EWlz05Bypj8LRq7r_CA',
  authDomain: 'grp-gov-push.firebaseapp.com',
  projectId: 'grp-gov-push',
  storageBucket: 'grp-gov-push.appspot.com',
  messagingSenderId: '55096092431',
  appId: '1:55096092431:web:b58de51bbb7c3f3c0cc07a',
  measurementId: 'G-6CNWJLWFQK',
};

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

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
    const serviceWorkerRegistration = await getMessagingServiceWorkerRegistration();
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
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

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

export const listenForForegroundMessages = (handler) => {
  return onMessage(messaging, (payload) => {
    if (typeof handler === 'function') handler(payload);
  });
};
