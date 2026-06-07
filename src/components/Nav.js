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

  const dashboardBtnStyle = {
    background: '#C9A84C',
    color: '#1A1A1A',
    border: 'none',
    borderRadius: 8,
    padding: isMobile ? '6px 10px' : '6px 12px',
    fontSize: isMobile ? 11 : 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    lineHeight: 1.2,
  };

  return (
    <nav
      className={`app-no-select app-portal-nav${isMobile && includeSafeAreaTop ? ' app-portal-nav--safe-top' : ''}${showAdminPreview ? ' app-portal-nav--admin' : ''}`}
      style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: showAdminPreview && isMobile ? undefined : (showAdminPreview ? '#161616' : t.navBg),
      backdropFilter: showAdminPreview ? 'none' : 'blur(16px)',
      WebkitBackdropFilter: showAdminPreview ? 'none' : 'blur(16px)',
      borderBottom: showAdminPreview ? '0.5px solid #2A2A2A' : `0.5px solid ${t.navBorder}`,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, minWidth: 0, flex: showAdminPreview && isMobile ? 1 : undefined }}>
        <button type="button" onClick={() => (onHome ? onHome() : setView('home'))} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile && showAdminPreview ? 17 : (isMobile ? 18 : 22), letterSpacing: '0.06em', color: showAdminPreview ? '#F5F2ED' : primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Global Access
        </button>
        {showAdminPreview && onPreviewUserTypeChange && (
          <div
            role="group"
            aria-label="Preview account type"
            style={{
              display: 'inline-flex',
              flexShrink: 0,
              borderRadius: 8,
              overflow: 'hidden',
              border: '0.5px solid #3A3A3A',
              background: '#0D0D0D',
            }}
          >
            {[
              ['retailer', isMobile ? 'Ret' : 'Retailer'],
              ['distributor', isMobile ? 'Dist' : 'Distributor'],
            ].map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => onPreviewUserTypeChange(type)}
                style={{
                  padding: isMobile ? '5px 8px' : '5px 10px',
                  fontSize: isMobile ? 10 : 11,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: previewUserType === type ? '#C9A84C' : 'transparent',
                  color: previewUserType === type ? '#1A1A1A' : '#888',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {showAdminPreview && isAdmin && onAdminClick && (
          <button type="button" onClick={onAdminClick} style={dashboardBtnStyle}>
            Dashboard
          </button>
        )}
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
        {isAdmin && onAdminClick && !showAdminPreview && (
          <button type="button" onClick={onAdminClick} style={dashboardBtnStyle}>
            Dashboard
          </button>
        )}
        {onLogout && (
          <button type="button" onClick={onLogout} style={{
            background: showAdminPreview ? '#252525' : (isNight ? t.bgSubtle : 'rgba(255,255,255,0.6)'),
            border: showAdminPreview ? '0.5px solid #3A3A3A' : t.borderHairlineLight,
            borderRadius: 8,
            padding: isMobile ? '6px 8px' : '6px 12px',
            fontSize: isMobile ? 10 : 12,
            color: showAdminPreview ? '#AAA' : t.textMuted,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            lineHeight: 1.2,
          }}>
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
