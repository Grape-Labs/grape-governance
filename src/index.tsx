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
    //navigator.serviceWorker.register('./serviceWorker.js')
      .then(registration => console.log('Service worker registered'))
      .catch(err => console.error('Service worker registration failed:', err));
}