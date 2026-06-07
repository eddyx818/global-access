import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

const TAB_IDS = ['overview', 'community', 'contacts', 'pages', 'clicks', 'requests', 'inquiries', 'content', 'users', 'map', 'brands', 'marketing'];

export default function AdminTabBar({ activeTab, onTabChange, pendingCount = 0, onRefresh }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const scrollRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollHints();
    const el = scrollRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', updateScrollHints, { passive: true });
    window.addEventListener('resize', updateScrollHints);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollHints) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollHints);
      window.removeEventListener('resize', updateScrollHints);
      ro?.disconnect();
    };
  }, [updateScrollHints]);

  const scrollByAmount = (delta) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const endDrag = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const el = scrollRef.current;
    if (el) el.style.cursor = 'grab';
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const el = scrollRef.current;
      if (!el) return;
      e.preventDefault();
      const dx = e.pageX - dragRef.current.startX;
      if (Math.abs(dx) > 4) dragRef.current.moved = true;
      el.scrollLeft = dragRef.current.scrollLeft - dx;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', endDrag);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', endDrag);
    };
  }, [endDrag]);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      startX: e.pageX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    el.style.cursor = 'grabbing';
  };

  const handleTabClick = (tabId) => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    onTabChange(tabId);
  };

  const arrowBtn = (dir, enabled, onClick) => (
    <button
      type="button"
      aria-label={dir === 'left' ? 'Scroll tabs left' : 'Scroll tabs right'}
      onClick={onClick}
      disabled={!enabled}
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 8,
        border: t.borderHairline,
        background: enabled ? t.bgElevated : t.bgMuted,
        color: enabled ? t.textMuted : t.textDisabled,
        cursor: enabled ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        lineHeight: 1,
        fontFamily: 'inherit',
        opacity: enabled ? 1 : 0.45,
        transition: 'opacity 0.15s ease, background 0.15s ease',
      }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  );

  const showArrows = canScrollLeft || canScrollRight;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem' }}>
      {showArrows && arrowBtn('left', canScrollLeft, () => scrollByAmount(-180))}
      <div
        ref={scrollRef}
        className="admin-tab-scroll"
        onMouseDown={onMouseDown}
        onMouseLeave={endDrag}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          flexWrap: 'nowrap',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 4,
          cursor: 'grab',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {TAB_IDS.map(tabId => (
          <button
            key={tabId}
            type="button"
            onClick={() => handleTabClick(tabId)}
            style={{ ...ui.tabBtn(activeTab === tabId), flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {tabId === 'requests' && pendingCount > 0
              ? `Requests (${pendingCount})`
              : tabId.charAt(0).toUpperCase() + tabId.slice(1)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { if (!dragRef.current.moved) onRefresh(); }}
          style={{ ...ui.tabBtn(false), flexShrink: 0, marginLeft: 'auto', whiteSpace: 'nowrap' }}
        >
          ↻ Refresh
        </button>
      </div>
      {showArrows && arrowBtn('right', canScrollRight, () => scrollByAmount(180))}
      <style>{`.admin-tab-scroll::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
