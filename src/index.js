import React from 'react';
import ReactDOM from 'react-dom/client';
import './app.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { BrandContentProvider } from './lib/content';
import { applyTheme, getStoredTheme } from './lib/theme';
import { initSafeAreaInsets } from './lib/safeAreaInsets';
import { initAppSession } from './lib/appSession';

document.documentElement.classList.add('app-native');
initAppSession();
initSafeAreaInsets();
applyTheme(getStoredTheme());

// Block iOS pinch-zoom (Safari may ignore viewport meta in some cases)
['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
  document.addEventListener(evt, (e) => e.preventDefault());
});

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update();
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {});

    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <BrandContentProvider>
      <App />
    </BrandContentProvider>
  </ThemeProvider>
);
