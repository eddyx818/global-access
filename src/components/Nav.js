import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { getButtonRadius } from '../lib/design';

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
  includeSafeAreaTop = true,
  unread = 0,
  showCustomerList = true,
  onQuotes = null,
  quotesNewCount = 0,
}) {
  const { t, isNight } = useTheme();
  const primary = isNight ? t.text : (globalStyles.primary_color || t.text);
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
    <nav
      className={`app-no-select app-portal-nav${isMobile && includeSafeAreaTop ? ' app-portal-nav--safe-top' : ''}`}
      style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: t.navBg,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `0.5px solid ${t.navBorder}`,
      ...(isMobile ? {} : {
        boxSizing: 'border-box',
        flexShrink: 0,
        height: 52,
        paddingLeft: '1.25rem',
        paddingRight: '1.25rem',
        paddingTop: 0,
        paddingBottom: 0,
      }),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'background 0.35s ease, border-color 0.35s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, minWidth: 0 }}>
        <button type="button" onClick={() => (onHome ? onHome() : setView('home'))} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 18 : 22, letterSpacing: '0.08em', color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Global Access
        </button>
        {!isMobile && navigation.map(item => (
          <button key={item.id} type="button" onClick={() => handleNavItem(item)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: t.textSecondary, fontFamily: 'inherit', padding: '4px 0', letterSpacing: '0.02em' }}>
            {item.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexShrink: 0 }}>
        {showCustomerList && interests.length > 0 && view !== 'interest' && !hideMobileActions && (
          <button type="button" onClick={() => setView('interest')} style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: btnRadius >= 18 ? 20 : btnRadius, padding: isMobile ? '5px 12px' : '6px 16px', fontSize: isMobile ? 11 : 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {isMobile ? `List (${interests.length})` : `My List (${interests.length})`}
          </button>
        )}
        {!showCustomerList && onQuotes && !hideMobileActions && (
          <button type="button" onClick={onQuotes} style={{ background: t.goldBg, color: t.gold, border: `0.5px solid ${t.gold}`, borderRadius: btnRadius >= 18 ? 20 : btnRadius, padding: isMobile ? '5px 12px' : '6px 16px', fontSize: isMobile ? 11 : 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }}>
            Quotes{quotesNewCount > 0 ? ` (${quotesNewCount})` : ''}
          </button>
        )}
        {onChat && !hideMobileActions && (
          <button type="button" onClick={onChat} style={{ background: t.accentBg, color: t.accentDark, border: `0.5px solid ${t.accentBorder}`, borderRadius: 20, padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', position: 'relative' }}>
            {chatLabel}
            {unread > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: t.accent, color: '#FFF', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        )}
        {onProfile && !hideMobileActions && (
          <button type="button" onClick={onProfile} style={{ background: isNight ? t.bgSubtle : 'rgba(255,255,255,0.6)', border: t.borderHairlineLight, borderRadius: 20, padding: '5px 12px', fontSize: 12, color: t.textSecondary, cursor: 'pointer', fontFamily: 'inherit' }}>
            Profile
          </button>
        )}
        {isAdmin && onAdminClick && (
          <button type="button" onClick={onAdminClick} style={{ background: t.goldBg, color: t.gold, border: `0.5px solid ${t.gold}`, borderRadius: 20, padding: isMobile ? '4px 10px' : '5px 14px', fontSize: isMobile ? 10 : 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Dashboard
          </button>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} style={{ background: isNight ? t.bgSubtle : 'rgba(255,255,255,0.6)', border: t.borderHairlineLight, borderRadius: 20, padding: isMobile ? '4px 8px' : '5px 12px', fontSize: isMobile ? 10 : 12, color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
