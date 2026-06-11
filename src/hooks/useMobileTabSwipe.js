import { useEffect, useRef } from 'react';

const SWIPE_MIN_PX = 56;
const SWIPE_MAX_VERTICAL_PX = 48;

/**
 * Horizontal swipe on main content to move between mobile bottom-nav tabs.
 * Ignores swipes that start on inputs, textareas, buttons, or horizontally scrollable regions.
 */
export default function useMobileTabSwipe({
  enabled = false,
  tabs = [],
  activeTabId = 'home',
  containerRef,
}) {
  const touchRef = useRef({ startX: 0, startY: 0, tracking: false });

  useEffect(() => {
    if (!enabled || !tabs.length || !containerRef?.current) return undefined;

    const el = containerRef.current;

    const tabIndex = () => {
      const idx = tabs.findIndex(t => t.id === activeTabId);
      return idx >= 0 ? idx : 0;
    };

    const blockedTarget = (target) => {
      if (!target?.closest) return false;
      return !!target.closest(
        'input, textarea, select, button, a, [contenteditable="true"], .hero-carousel, .home-brand-grid, [data-no-tab-swipe]',
      );
    };

    const onTouchStart = (e) => {
      if (blockedTarget(e.target)) return;
      const t = e.changedTouches?.[0] || e.touches?.[0];
      if (!t) return;
      touchRef.current = { startX: t.clientX, startY: t.clientY, tracking: true };
    };

    const onTouchEnd = (e) => {
      if (!touchRef.current.tracking) return;
      touchRef.current.tracking = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - touchRef.current.startX;
      const dy = t.clientY - touchRef.current.startY;
      if (Math.abs(dy) > SWIPE_MAX_VERTICAL_PX) return;
      if (Math.abs(dx) < SWIPE_MIN_PX) return;

      const idx = tabIndex();
      if (dx < 0 && idx < tabs.length - 1) {
        tabs[idx + 1].onSelect();
      } else if (dx > 0 && idx > 0) {
        tabs[idx - 1].onSelect();
      }
    };

    const onTouchCancel = () => {
      touchRef.current.tracking = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled, tabs, activeTabId, containerRef]);
}
