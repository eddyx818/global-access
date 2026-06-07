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
  showAdminPreview = false,
  previewUserType = 'retailer',
  onPreviewUserTypeChange = null,
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

  const glassSurface = {
    background: isNight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: isNight ? '0.5px solid rgba(255, 255, 255, 0.12)' : '0.5px solid rgba(0, 0, 0, 0.08)',
  };

  const dashboardBtnStyle = {
    ...glassSurface,
    background: isNight ? 'rgba(212, 180, 90, 0.22)' : 'rgba(201, 168, 76, 0.28)',
    color: isNight ? '#E8D08A' : '#6B5210',
    border: isNight ? '0.5px solid rgba(212, 180, 90, 0.45)' : '0.5px solid rgba(201, 168, 76, 0.5)',
    borderRadius: 10,
    padding: isMobile ? '6px 10px' : '6px 12px',
    fontSize: isMobile ? 11 : 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    lineHeight: 1.2,
  };

  const signOutBtnStyle = {
    ...glassSurface,
    borderRadius: 10,
    padding: isMobile ? '6px 8px' : '6px 12px',
    fontSize: isMobile ? 10 : 12,
    color: t.textMuted,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    lineHeight: 1.2,
  };

  const previewToggle = showAdminPreview && onPreviewUserTypeChange ? (
    <div
      role="group"
      aria-label="Preview account type"
      className="app-portal-nav__preview-toggle"
      style={{
        display: 'inline-flex',
        flexShrink: 0,
        borderRadius: 10,
        overflow: 'hidden',
        ...glassSurface,
        background: isNight ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.45)',
      }}
    >
      {[
        ['retailer', isMobile ? 'Retailer' : 'Retailer'],
        ['distributor', isMobile ? 'Distro' : 'Distributor'],
      ].map(([type, label]) => (
        <button
          key={type}
          type="button"
          onClick={() => onPreviewUserTypeChange(type)}
          style={{
            padding: isMobile ? '6px 10px' : '6px 12px',
            fontSize: isMobile ? 10 : 11,
            fontWeight: 700,
            letterSpacing: '0.02em',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: previewUserType === type
              ? (isNight ? 'rgba(212, 180, 90, 0.32)' : 'rgba(201, 168, 76, 0.38)')
              : 'transparent',
            color: previewUserType === type ? (isNight ? '#F0E2B0' : '#5C4808') : t.textMuted,
            whiteSpace: 'nowrap',
            backdropFilter: previewUserType === type ? 'blur(8px)' : undefined,
            WebkitBackdropFilter: previewUserType === type ? 'blur(8px)' : undefined,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  const navBody = showAdminPreview ? (
    <>
      <div className="app-portal-nav__left">
        <button type="button" onClick={() => (onHome ? onHome() : setView('home'))} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? 17 : 22, letterSpacing: '0.06em', color: primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Global Access
        </button>
        {previewToggle}
      </div>
      <div className="app-portal-nav__right">
        {isAdmin && onAdminClick && (
          <button type="button" onClick={onAdminClick} style={dashboardBtnStyle}>
            Dashboard
          </button>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} style={signOutBtnStyle}>
            Sign out
          </button>
        )}
      </div>
    </>
  ) : (
    <>
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
          <button type="button" onClick={onAdminClick} style={dashboardBtnStyle}>
            Dashboard
          </button>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} style={{
            background: isNight ? t.bgSubtle : 'rgba(255,255,255,0.6)',
            border: t.borderHairlineLight,
            borderRadius: 20,
            padding: isMobile ? '4px 8px' : '5px 12px',
            fontSize: isMobile ? 10 : 12,
            color: t.textMuted,
            cursor: 'pointer',
            fontFamily: 'inherit',
            backdropFilter: 'blur(4px)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            Sign out
          </button>
        )}
      </div>
    </>
  );

  return (
    <nav
      className={`app-no-select app-portal-nav${isMobile && includeSafeAreaTop ? ' app-portal-nav--safe-top' : ''}${showAdminPreview ? ' app-portal-nav--admin' : ''}`}
      style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: t.navBg,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
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
      flexDirection: showAdminPreview && isMobile && includeSafeAreaTop ? 'column' : undefined,
      alignItems: showAdminPreview && isMobile && includeSafeAreaTop ? 'stretch' : 'center',
      justifyContent: 'space-between',
      transition: 'background 0.35s ease, border-color 0.35s ease',
    }}>
      {showAdminPreview && isMobile && includeSafeAreaTop ? (
        <div className="app-portal-nav__row">{navBody}</div>
      ) : (
        navBody
      )}
    </nav>
  );
}
