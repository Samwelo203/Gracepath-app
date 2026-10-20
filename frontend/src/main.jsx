import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.gracePathInstallPrompt = event;
    window.dispatchEvent(new Event('gracepathinstallprompt'));
  });
  window.addEventListener('appinstalled', () => {
    window.gracePathInstallPrompt = null;
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);