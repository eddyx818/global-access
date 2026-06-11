import React, { useMemo, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { COPY, portalType } from '../lib/portalCopy';

const PILL_PAD_X = 6;
const THUMB_INSET = 2;
const DRAG_START_PX = 8;

function segmentMetrics(pillWidth, count) {
  const inner = Math.max(0, pillWidth - PILL_PAD_X * 2);
  const segW = inner / Math.max(count, 1);
  const thumbW = Math.max(0, segW - THUMB_INSET * 2);
  return { inner, segW, thumbW };
}

function thumbLeftForIndex(idx, segW, thumbW) {
  return PILL_PAD_X + idx * segW + THUMB_INSET + (segW - THUMB_INSET * 2 - thumbW) / 2;
}

function indexFromThumbLeft(left, count, segW) {
  if (count <= 1) return 0;
  const idx = Math.round((left - PILL_PAD_X - THUMB_INSET) / segW);
  return Math.min(count - 1, Math.max(0, idx));
}

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
  const pillRef = useRef(null);
  const dragRef = useRef({ active: false, didDrag: false, startX: 0, startY: 0 });
  const [dragging, setDragging] = useState(false);
  const [thumbLeft, setThumbLeft] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(null);

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

  const activeIndex = Math.max(0, items.findIndex(i => i.active));
  const highlightIndex = dragging && previewIndex != null ? previewIndex : activeIndex;

  const syncThumbToIndex = useCallback((idx) => {
    const pill = pillRef.current;
    if (!pill || !items.length) return;
    const { segW, thumbW } = segmentMetrics(pill.clientWidth, items.length);
    setThumbWidth(thumbW);
    setThumbLeft(thumbLeftForIndex(idx, segW, thumbW));
    setPreviewIndex(idx);
  }, [items.length]);

  useLayoutEffect(() => {
    if (dragging) return;
    syncThumbToIndex(activeIndex);
  }, [activeIndex, items.length, dragging, syncThumbToIndex]);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (!dragRef.current.active) syncThumbToIndex(activeIndex);
    });
    ro.observe(pill);
    return () => ro.disconnect();
  }, [activeIndex, syncThumbToIndex]);

  const positionFromClientX = (clientX) => {
    const pill = pillRef.current;
    if (!pill) return null;
    const rect = pill.getBoundingClientRect();
    const { segW, thumbW } = segmentMetrics(rect.width, items.length);
    const localX = clientX - rect.left;
    let left = localX - thumbW / 2;
    const minLeft = thumbLeftForIndex(0, segW, thumbW);
    const maxLeft = thumbLeftForIndex(items.length - 1, segW, thumbW);
    left = Math.min(maxLeft, Math.max(minLeft, left));
    const idx = indexFromThumbLeft(left, items.length, segW);
    return { left, thumbW, idx, segW };
  };

  const thumbBounds = () => {
    const pill = pillRef.current;
    if (!pill) return null;
    const { segW, thumbW } = segmentMetrics(pill.clientWidth, items.length);
    return {
      thumbW,
      minLeft: thumbLeftForIndex(0, segW, thumbW),
      maxLeft: thumbLeftForIndex(items.length - 1, segW, thumbW),
      segW,
    };
  };

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const bounds = thumbBounds();
    if (!bounds) return;
    dragRef.current = {
      active: true,
      didDrag: false,
      startX: e.clientX,
      startY: e.clientY,
      startThumbLeft: thumbLeftForIndex(activeIndex, bounds.segW, bounds.thumbW),
    };
    setDragging(true);
    pillRef.current?.setPointerCapture(e.pointerId);
    setPreviewIndex(activeIndex);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (!dragRef.current.didDrag) {
      if (Math.abs(dx) <= DRAG_START_PX && Math.abs(dy) <= DRAG_START_PX) return;
      dragRef.current.didDrag = true;
    }
    const bounds = thumbBounds();
    if (!bounds) return;
    let left = dragRef.current.startThumbLeft + dx;
    left = Math.min(bounds.maxLeft, Math.max(bounds.minLeft, left));
    const idx = indexFromThumbLeft(left, items.length, bounds.segW);
    setThumbWidth(bounds.thumbW);
    setThumbLeft(left);
    setPreviewIndex(idx);
  };

  const finishPointer = (e) => {
    if (!dragRef.current.active) return;
    try {
      pillRef.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}
    const wasDrag = dragRef.current.didDrag;
    dragRef.current.active = false;
    setDragging(false);

    if (!wasDrag) {
      const pos = positionFromClientX(e.clientX);
      if (pos?.idx != null && pos.idx !== activeIndex) {
        items[pos.idx]?.onClick();
      }
      return;
    }

    const bounds = thumbBounds();
    if (!bounds) {
      syncThumbToIndex(activeIndex);
      return;
    }
    const dx = e.clientX - dragRef.current.startX;
    let left = dragRef.current.startThumbLeft + dx;
    left = Math.min(bounds.maxLeft, Math.max(bounds.minLeft, left));
    const idx = indexFromThumbLeft(left, items.length, bounds.segW);

    if (idx !== activeIndex) {
      items[idx]?.onClick();
    } else {
      syncThumbToIndex(activeIndex);
    }
  };
  const pillBg = isNight ? 'rgba(28, 28, 34, 0.72)' : 'rgba(255, 255, 255, 0.78)';
  const pillBorder = isNight ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
  const thumbBg = isNight ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.07)';

  return (
    <nav
      className="app-no-select app-bottom-nav app-bottom-nav--floating"
      aria-label="Main navigation"
    >
      <div
        ref={pillRef}
        className={`app-bottom-nav__pill${dragging ? ' app-bottom-nav__pill--dragging' : ''}`}
        style={{
          background: pillBg,
          border: `0.5px solid ${pillBorder}`,
          boxShadow: isNight
            ? '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
            : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.65)',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <div
          className="app-bottom-nav__thumb"
          aria-hidden="true"
          style={{
            width: thumbWidth,
            transform: `translateX(${thumbLeft}px)`,
            background: thumbBg,
            transition: dragging ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), width 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        />
        {items.map((item, idx) => {
          const highlighted = idx === highlightIndex;
          return (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              aria-current={item.active ? 'page' : undefined}
              className={`app-bottom-nav__item${highlighted ? ' app-bottom-nav__item--highlighted' : ''}`}
              style={{
                color: highlighted ? t.text : t.textMuted,
                pointerEvents: 'none',
              }}
            >
              <span
                className={`app-bottom-nav__icon${item.id === 'home' ? ' app-bottom-nav__icon--home' : ''}`}
                style={{
                  filter: highlighted ? 'none' : 'grayscale(0.25)',
                  opacity: highlighted ? 1 : 0.8,
                }}
              >
                {item.icon}
              </span>
              <span className="app-bottom-nav__label" style={{
                ...(highlighted ? portalType.navLabelActive : portalType.navLabel),
                color: highlighted ? (item.accent ? t.accentDark : t.text) : t.textFaint,
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
          );
        })}
      </div>
    </nav>
  );
}
