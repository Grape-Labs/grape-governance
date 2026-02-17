import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(
    <StrictMode>
        <App />
    </StrictMode>,
    document.getElementById('app')
);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('./serviceWorker.js', import.meta.url))
      .then(registration => {
        // Activate waiting updates immediately.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        console.log('Service worker registered');
      })
      .catch(err => console.error('Service worker registration failed:', err));
}
