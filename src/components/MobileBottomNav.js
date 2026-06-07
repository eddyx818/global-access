import React from 'react';

export default function MobileBottomNav({
  activeView,
  onHome,
  onList,
  onChat,
  onProfile,
  listCount = 0,
  unread = 0,
  chatLabel = 'Support',
  showList = true,
  showChat = true,
  showProfile = true,
}) {
  const items = [
    { id: 'home', label: 'Home', icon: '⌂', onClick: onHome, active: activeView === 'home' || activeView === 'brand' },
    showList && { id: 'list', label: 'My List', icon: '☰', onClick: onList, active: activeView === 'interest', badge: listCount || null },
    showChat && { id: 'chat', label: chatLabel, icon: '💬', onClick: onChat, active: activeView === 'chat', badge: unread || null, accent: true },
    showProfile && { id: 'profile', label: 'Profile', icon: '👤', onClick: onProfile, active: false },
  ].filter(Boolean);

  return (
    <nav
      className="app-no-select"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 400,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(224,221,216,0.9)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'space-around', minHeight: 56 }}>
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '8px 4px 10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              position: 'relative',
              color: item.active ? '#1A1A1A' : '#999',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{
              fontSize: 20,
              lineHeight: 1,
              filter: item.active ? 'none' : 'grayscale(0.3)',
              opacity: item.active ? 1 : 0.75,
            }}>
              {item.icon}
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: item.active ? 700 : 500,
              letterSpacing: '0.02em',
              color: item.active ? (item.accent ? '#2D7A50' : '#1A1A1A') : '#AAA',
            }}>
              {item.label}
            </span>
            {item.active && (
              <span style={{
                position: 'absolute',
                top: 4,
                width: 20,
                height: 3,
                borderRadius: 2,
                background: item.accent ? '#4CAF7D' : '#C9A84C',
              }} />
            )}
            {item.badge > 0 && (
              <span style={{
                position: 'absolute',
                top: 4,
                right: '18%',
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                background: item.id === 'chat' ? '#4CAF7D' : '#1A1A1A',
                color: '#FFF',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}>
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
