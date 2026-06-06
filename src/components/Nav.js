import React from 'react';

export default function Nav({ interests, view, setView, onLogout, isAdmin, onAdminClick }) {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(245,242,237,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '0.5px solid rgba(224,221,216,0.6)', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
      <button onClick={() => setView('home')} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.1em', color: '#1A1A1A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Global Access</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {interests.length > 0 && view !== 'interest' && (
          <button onClick={() => setView('interest')} style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 20, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            My List ({interests.length})
          </button>
        )}
        {isAdmin && (
          <button onClick={onAdminClick} style={{ background: 'rgba(201,168,76,0.15)', color: '#A07A20', border: '0.5px solid rgba(201,168,76,0.4)', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em', backdropFilter: 'blur(4px)' }}>
            Admin
          </button>
        )}
        {onLogout && (
          <button onClick={onLogout} style={{ background: 'rgba(255,255,255,0.6)', border: '0.5px solid rgba(224,221,216,0.8)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}>Sign out</button>
        )}
      </div>
    </nav>
  );
}
