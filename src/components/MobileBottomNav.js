import React, { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { COPY, portalType } from '../lib/portalCopy';

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
  listLabel = COPY.myList,
  showQuotes = false,
  showPriceChecks = false,
  onMyQuotes = null,
  myQuotesCount = 0,
  showMyQuotes = false,
  showChat = false,
  showProfile = true,
  homeLabel = COPY.home,
}) {
  const { t, isNight } = useTheme();

  const priceCheckBadge = (priceCheckCount || 0) + (priceCheckDraftCount > 0 ? priceCheckDraftCount : 0);

  const items = useMemo(() => [
    { id: 'home', label: homeLabel, icon: '⌂', onClick: onHome, active: activeView === 'home' || activeView === 'brand' },
    showList && { id: 'list', label: listLabel, icon: '☰', onClick: onList, active: activeView === 'interest', badge: listCount || null },
    showQuotes && { id: 'quotes', label: COPY.quotes, icon: '📋', onClick: onQuotes, active: activeView === 'quotes', badge: quotesCount || null },
    showPriceChecks && { id: 'price_checks', label: COPY.priceCheck, icon: '◇', onClick: onPriceChecks, active: activeView === 'price_checks', badge: priceCheckBadge || null },
    showMyQuotes && { id: 'my_quotes', label: COPY.myQuotes, icon: '✦', onClick: onMyQuotes, active: activeView === 'my_quotes', badge: myQuotesCount || null },
    showChat && { id: 'chat', label: chatLabel, icon: '💬', onClick: onChat, active: activeView === 'chat', badge: unread || null, accent: true },
    showProfile && { id: 'profile', label: 'Profile', icon: '👤', onClick: onProfile, active: activeView === 'profile' },
  ].filter(Boolean), [
    activeView, homeLabel, onHome, showList, listLabel, onList, listCount,
    showQuotes, onQuotes, quotesCount, showPriceChecks, onPriceChecks, priceCheckBadge,
    showMyQuotes, onMyQuotes, myQuotesCount, showChat, chatLabel, onChat, unread,
    showProfile, onProfile,
  ]);

  const pillBg = isNight ? 'rgba(28, 28, 34, 0.72)' : 'rgba(255, 255, 255, 0.78)';
  const pillBorder = isNight ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
  const activePillBg = isNight ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.07)';

  return (
    <nav
      className="app-no-select app-bottom-nav app-bottom-nav--floating"
      aria-label="Main navigation"
    >
      <div
        className="app-bottom-nav__pill"
        style={{
          background: pillBg,
          border: `0.5px solid ${pillBorder}`,
          boxShadow: isNight
            ? '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
            : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.65)',
        }}
      >
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`app-bottom-nav__item${item.active ? ' app-bottom-nav__item--active' : ''}`}
            aria-current={item.active ? 'page' : undefined}
            style={{
              background: item.active ? activePillBg : 'transparent',
              color: item.active ? t.text : t.textMuted,
            }}
          >
            <span className="app-bottom-nav__icon" style={{
              filter: item.active ? 'none' : 'grayscale(0.25)',
              opacity: item.active ? 1 : 0.8,
            }}>
              {item.icon}
            </span>
            <span className="app-bottom-nav__label" style={{
              ...(item.active ? portalType.navLabelActive : portalType.navLabel),
              color: item.active ? (item.accent ? t.accentDark : t.text) : t.textFaint,
            }}>
              {item.label}
            </span>
            {item.badge > 0 && (
              <span className="app-bottom-nav__badge" style={{
                background: item.id === 'chat' ? t.accent : t.btnPrimaryBg,
                color: item.id === 'chat' ? '#FFF' : t.btnPrimaryText,
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
