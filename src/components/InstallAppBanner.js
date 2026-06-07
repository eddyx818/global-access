import React, { useState } from 'react';

export default function InstallAppBanner({ canInstall, showIosHint, onInstall, onDismiss }) {
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
    <div style={{
      background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
      color: '#FFF',
      padding: '12px 1rem',
      paddingTop: 'max(12px, env(safe-area-inset-top))',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: '0.5px solid rgba(201,168,76,0.35)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#F5F2ED',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 22,
        color: '#C9A84C',
        flexShrink: 0,
      }}>
        G
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
