const KEYBOARD_INSET_THRESHOLD = 40;
const MAX_SAFE_BOTTOM_INSET = 40;

function scheduleViewportRecalc(apply) {
  apply();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(apply);
  }
  window.setTimeout(apply, 100);
  window.setTimeout(apply, 300);
}

/** Detect installed / fullscreen app shells (iOS, Android, TWA). */
export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
}

/** Phones/tablets — coarse pointer, narrow width, or mobile UA. */
export function isMobileEnvironment() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches
    || window.matchMedia('(pointer: coarse)').matches
    || /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent || '');
}

/**
 * visualViewport fallback for PWAs where env(safe-area-inset-*) returns 0
 * (common when installed to the home screen on iPhones with Dynamic Island).
 * Also helps Android phones with display cutouts.
 */
export function initSafeAreaInsets() {
  const root = document.documentElement;

  if (isStandaloneDisplayMode()) root.classList.add('app-standalone');
  if (isMobileEnvironment()) root.classList.add('app-mobile');

  const applyVisualViewportInsets = () => {
    const vv = window.visualViewport;
    if (!vv) return;

    const top = Math.max(0, Math.round(vv.offsetTop));
    const left = Math.max(0, Math.round(vv.offsetLeft));
    const rawBottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    const right = Math.max(0, Math.round(window.innerWidth - vv.width - vv.offsetLeft));

    // Keyboard gap must not become permanent bottom safe-area padding after app resume.
    const bottom = rawBottom > KEYBOARD_INSET_THRESHOLD
      ? 0
      : Math.min(rawBottom, MAX_SAFE_BOTTOM_INSET);

    // Prefer JS fallback in installed shells; still set on mobile when insets are non-zero.
    if (isStandaloneDisplayMode() || isMobileEnvironment()) {
      root.style.setProperty('--ga-vv-top', `${top}px`);
      root.style.setProperty('--ga-vv-bottom', `${bottom}px`);
      root.style.setProperty('--ga-vv-left', `${left}px`);
      root.style.setProperty('--ga-vv-right', `${right}px`);
    }
  };

  applyVisualViewportInsets();

  window.visualViewport?.addEventListener('resize', applyVisualViewportInsets);
  window.visualViewport?.addEventListener('scroll', applyVisualViewportInsets);
  window.addEventListener('resize', applyVisualViewportInsets);
  window.addEventListener('orientationchange', () => {
    scheduleViewportRecalc(applyVisualViewportInsets);
  });
  window.addEventListener('pageshow', () => {
    scheduleViewportRecalc(applyVisualViewportInsets);
  });
  window.addEventListener('focus', () => {
    scheduleViewportRecalc(applyVisualViewportInsets);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleViewportRecalc(applyVisualViewportInsets);
  });
}

/** Re-run visualViewport inset math (e.g. after iOS PWA background/foreground). */
export function recalculateSafeAreaInsets() {
  if (typeof window === 'undefined' || !window.visualViewport) return;
  const root = document.documentElement;
  const vv = window.visualViewport;
  const top = Math.max(0, Math.round(vv.offsetTop));
  const left = Math.max(0, Math.round(vv.offsetLeft));
  const rawBottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  const right = Math.max(0, Math.round(window.innerWidth - vv.width - vv.offsetLeft));
  const bottom = rawBottom > KEYBOARD_INSET_THRESHOLD
    ? 0
    : Math.min(rawBottom, MAX_SAFE_BOTTOM_INSET);
  if (isStandaloneDisplayMode() || isMobileEnvironment()) {
    root.style.setProperty('--ga-vv-top', `${top}px`);
    root.style.setProperty('--ga-vv-bottom', `${bottom}px`);
    root.style.setProperty('--ga-vv-left', `${left}px`);
    root.style.setProperty('--ga-vv-right', `${right}px`);
  }
}
