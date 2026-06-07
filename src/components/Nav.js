import React from 'react';

export default function Nav({ interests, view, setView, onLogout, isAdmin, onAdminClick, navigation = [], globalStyles = {}, onNavClick, onProfile, onChat, chatLabel = 'Messages' }) {
  const primary = globalStyles.primary_color || '#1A1A1A';
  const btnRadius = getButtonRadius(globalStyles.button_style);

  const handleNavItem = (item) => {
    if (onNavClick) { onNavClick(item); return; }
    if (item.url?.startsWith('#')) {
      window.location.hash = item.url.replace('#', '');
    } else if (item.url?.startsWith('http')) {
      window.open(item.url, '_blank');
    } else {
      setView('home');
    }
  };

  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(245,242,237,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '0.5px solid rgba(224,221,216,0.6)', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => setView('home')} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.1em', color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Global Access</button>
        {navigation.map(item => (
          <button key={item.id} onClick={() => handleNavItem(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#666', fontFamily: 'inherit', padding: '4px 0', letterSpacing: '0.02em' }}>
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {interests.length > 0 && view !== 'interest' && (
          <button onClick={() => setView('interest')} style={{ background: primary, color: '#FFF', border: 'none', borderRadius: btnRadius >= 18 ? 20 : btnRadius, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            My List ({interests.length})
          </button>
        )}
        {onChat && (
          <button onClick={onChat} style={{ background: 'rgba(76,175,125,0.12)', color: '#2D7A50', border: '0.5px solid rgba(76,175,125,0.35)', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {chatLabel}
          </button>
        )}
        {onProfile && (
          <button onClick={onProfile} style={{ background: 'rgba(255,255,255,0.6)', border: '0.5px solid rgba(224,221,216,0.8)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
            Profile
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

function getButtonRadius(buttonStyle) {
  return ({ rounded: 14, pill: 20, square: 6 }[buttonStyle] ?? 14);
}
