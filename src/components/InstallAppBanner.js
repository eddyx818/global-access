import React, { useState } from 'react';
import SiteLogo from './SiteLogo';

export default function InstallAppBanner({ canInstall, showIosHint, onInstall, onDismiss, className = '' }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('ga-install-dismissed') === '1'; } catch (_) { return false; }
  });

  if (dismissed || (!canInstall && !showIosHint)) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('ga-install-dismissed', '1'); } catch (_) {}
    onDismiss?.();
  };

  return (
    <div className={`app-top-chrome app-safe-top-chrome${className ? ` ${className}` : ''}`} style={{
      '--app-chrome-pad-top': '12px',
      background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
      color: '#FFF',
      paddingLeft: '1rem',
      paddingRight: '1rem',
      paddingBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: '0.5px solid rgba(201,168,76,0.35)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      }}>
        <SiteLogo height={40} style={{ width: 40, objectFit: 'cover' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Install Global Access</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
          {showIosHint && !canInstall
            ? 'Tap Share → Add to Home Screen for the app experience.'
            : 'Add to your home screen for faster access and full-screen browsing.'}
        </div>
      </div>
      {canInstall && (
        <button
          type="button"
          onClick={onInstall}
          style={{
            background: '#C9A84C',
            color: '#1A1A1A',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, padding: 4, fontFamily: 'inherit' }}
      >
        ×
      </button>
    </div>
  );
}
