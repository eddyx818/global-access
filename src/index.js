import React from 'react';
import ReactDOM from 'react-dom/client';
import './app.css';
import App from './App';

document.documentElement.classList.add('app-native');

// Block iOS pinch-zoom (Safari may ignore viewport meta in some cases)
['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
  document.addEventListener(evt, (e) => e.preventDefault());
});

if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
