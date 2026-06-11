import { useEffect, useRef } from 'react';

const SWIPE_MIN_PX = 44;
const SWIPE_RATIO = 1.35;

function isBlockedSwipeTarget(target) {
  if (!target?.closest) return false;
  if (target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-no-tab-swipe]')) {
    return true;
  }
  // Hero has its own horizontal carousel — tab swipe works below it on catalog home.
  if (target.closest('.hero-carousel')) return true;
  return false;
}

function attachHorizontalSwipe(el, { onSwipeLeft, onSwipeRight, canStart }) {
  const state = { startX: 0, startY: 0, tracking: false, locked: null };

  const pointFromEvent = (e) => {
    if (e.changedTouches?.[0]) return e.changedTouches[0];
    if (e.touches?.[0]) return e.touches[0];
    return e;
  };

  const onStart = (e) => {
    if (canStart && !canStart(e)) return;
    const t = pointFromEvent(e);
    state.startX = t.clientX;
    state.startY = t.clientY;
    state.tracking = true;
    state.locked = null;
  };

  const onMove = (e) => {
    if (!state.tracking) return;
    const t = pointFromEvent(e);
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    if (state.locked == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      state.locked = Math.abs(dx) >= Math.abs(dy) * SWIPE_RATIO ? 'x' : 'y';
    }
  };

  const onEnd = (e) => {
    if (!state.tracking) return;
    state.tracking = false;
    const t = pointFromEvent(e);
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    if (state.locked === 'y') return;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
    state.locked = null;
  };

  const onCancel = () => {
    state.tracking = false;
    state.locked = null;
  };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: true });
  el.addEventListener('touchend', onEnd, { passive: true });
  el.addEventListener('touchcancel', onCancel, { passive: true });
  el.addEventListener('pointerdown', onStart);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onEnd);
  el.addEventListener('pointercancel', onCancel);

  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onCancel);
    el.removeEventListener('pointerdown', onStart);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onEnd);
    el.removeEventListener('pointercancel', onCancel);
  };
}

/** Horizontal swipe on main content to move between mobile bottom-nav tabs. */
export default function useMobileTabSwipe({
  enabled = false,
  tabs = [],
  activeTabId = 'home',
  containerRef,
}) {
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeTabId);
  tabsRef.current = tabs;
  activeRef.current = activeTabId;

  useEffect(() => {
    if (!enabled || !tabs.length || !containerRef?.current) return undefined;

    const go = (direction) => {
      const list = tabsRef.current;
      const idx = list.findIndex(t => t.id === activeRef.current);
      if (idx < 0) return;
      const next = idx + direction;
      if (next >= 0 && next < list.length) list[next].onSelect();
    };

    return attachHorizontalSwipe(containerRef.current, {
      onSwipeLeft: () => go(1),
      onSwipeRight: () => go(-1),
      canStart: (e) => !isBlockedSwipeTarget(e.target),
    });
  }, [enabled, tabs, activeTabId, containerRef]);
}

/** Swipe/drag on the floating nav pill itself. */
export function attachNavPillSwipe(pillEl, { onSwipeLeft, onSwipeRight }) {
  if (!pillEl) return () => {};
  return attachHorizontalSwipe(pillEl, { onSwipeLeft, onSwipeRight });
}
