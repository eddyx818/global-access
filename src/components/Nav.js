import React from 'react';

export default function Nav({
  interests,
  view,
  setView,
  onLogout,
  isAdmin,
  onAdminClick,
  navigation = [],
  globalStyles = {},
  onNavClick,
  onHome,
  onProfile,
  onChat,
  chatLabel = 'Messages',
  isMobile = false,
  hideMobileActions = false,
  unread = 0,
}) {
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
    <nav className="app-no-select" style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(245,242,237,0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '0.5px solid rgba(224,221,216,0.6)',
      height: isMobile ? 48 : 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '0 0.75rem' : '0 1.25rem',
      paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, minWidth: 0 }}>
        <button type="button" onClick={() => (onHome ? onHome() : setView('home'))} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 18 : 22, letterSpacing: '0.08em', color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Global Access
        </button>
        {!isMobile && navigation.map(item => (
          <button key={item.id} type="button" onClick={() => handleNavItem(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#666', fontFamily: 'inherit', padding: '4px 0', letterSpacing: '0.02em' }}>
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexShrink: 0 }}>
        {interests.length > 0 && view !== 'interest' && !hideMobileActions && (
          <button type="button" onClick={() => setView('interest')} style={{ background: primary, color: '#FFF', border: 'none', borderRadius: btnRadius >= 18 ? 20 : btnRadius, padding: isMobile ? '5px 12px' : '6px 16px', fontSize: isMobile ? 11 : 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {isMobile ? `List (${interests.length})` : `My List (${interests.length})`}
          </button>
        )}
        {onChat && !hideMobileActions && (
          <button type="button" onClick={onChat} style={{ background: 'rgba(76,175,125,0.12)', color: '#2D7A50', border: '0.5px solid rgba(76,175,125,0.35)', borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }}>
            {chatLabel}
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: '#4CAF7D', color: '#FFF', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        )}
        {onProfile && !hideMobileActions && (
          <button type="button" onClick={onProfile} style={{ background: 'rgba(255,255,255,0.6)', border: '0.5px solid rgba(224,221,216,0.8)', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>
            Profile
          </button>
        )}
        {isAdmin && (
          <button type="button" onClick={onAdminClick} style={{ background: 'rgba(201,168,76,0.15)', color: '#A07A20', border: '0.5px solid rgba(201,168,76,0.4)', borderRadius: 20, padding: isMobile ? '4px 10px' : '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.06em', backdropFilter: 'blur(4px)' }}>
            Admin
          </button>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} style={{ background: 'rgba(255,255,255,0.6)', border: '0.5px solid rgba(224,221,216,0.8)', borderRadius: 20, padding: isMobile ? '4px 10px' : '5px 12px', fontSize: isMobile ? 11 : 12, color: '#888', cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}>
            {isMobile ? 'Out' : 'Sign out'}
          </button>
        )}
      </div>
    </nav>
  );
}

function getButtonRadius(buttonStyle) {
  return ({ rounded: 14, pill: 20, square: 6 }[buttonStyle] ?? 14);
}
