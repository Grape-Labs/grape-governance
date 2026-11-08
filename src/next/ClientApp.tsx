import React, {useEffect} from 'react';
import '../i18n';
import App from '../App';
import {installNetworkGuards} from '../utils/networkGuards';

installNetworkGuards();

export default function ClientApp() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/serviceWorker.js', {scope: '/'}).then(registration => {
      if (registration.waiting) registration.waiting.postMessage({type: 'SKIP_WAITING'});
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) worker.postMessage({type: 'SKIP_WAITING'});
        });
      });
    }).catch(error => console.warn('Service worker registration failed', error));
  }, []);
  return <App />;
}
