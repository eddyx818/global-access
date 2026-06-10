import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function MobileBottomNav({
  activeView,
  onHome,
  onList,
  onQuotes,
  onPriceChecks,
  onChat,
  onProfile,
  listCount = 0,
  quotesCount = 0,
  priceCheckCount = 0,
  priceCheckDraftCount = 0,
  unread = 0,
  chatLabel = 'Support',
  showList = true,
  listLabel = 'My List',
  showQuotes = false,
  showPriceChecks = false,
  showChat = true,
  showProfile = true,
  homeLabel = 'Home',
}) {
  const { t } = useTheme();

  const priceCheckBadge = (priceCheckCount || 0) + (priceCheckDraftCount > 0 ? priceCheckDraftCount : 0);

  const items = [
    { id: 'home', label: homeLabel, icon: '⌂', onClick: onHome, active: activeView === 'home' || activeView === 'brand' },
    showList && { id: 'list', label: listLabel, icon: '☰', onClick: onList, active: activeView === 'interest', badge: listCount || null },
    showQuotes && { id: 'quotes', label: 'Quotes', icon: '📋', onClick: onQuotes, active: activeView === 'quotes', badge: quotesCount || null },
    showPriceChecks && { id: 'price_checks', label: 'Price Check', icon: '💰', onClick: onPriceChecks, active: activeView === 'price_checks', badge: priceCheckBadge || null },
    showChat && { id: 'chat', label: chatLabel, icon: '💬', onClick: onChat, active: activeView === 'chat', badge: unread || null, accent: true },
    showProfile && { id: 'profile', label: 'Profile', icon: '👤', onClick: onProfile, active: activeView === 'profile' },
  ].filter(Boolean);

  return (
    <nav
      className="app-no-select app-bottom-nav"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 400,
        background: t.bottomNavBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `0.5px solid ${t.navBorder}`,
        boxShadow: `0 -4px 24px ${t.shadow}`,
        transition: 'background 0.35s ease, border-color 0.35s ease',
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
              color: item.active ? t.text : t.textMuted,
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
              color: item.active ? (item.accent ? t.accentDark : t.text) : t.textFaint,
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
                background: item.accent ? t.accent : t.gold,
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
                background: item.id === 'chat' ? t.accent : t.btnPrimaryBg,
                color: item.id === 'chat' ? '#FFF' : t.btnPrimaryText,
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
