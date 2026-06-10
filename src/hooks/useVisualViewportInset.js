import { useEffect, useState } from 'react';
import { recalculateSafeAreaInsets } from '../lib/safeAreaInsets';

const KEYBOARD_THRESHOLD = 40;

function scheduleViewportUpdate(update) {
  update();
  requestAnimationFrame(update);
  window.setTimeout(update, 100);
  window.setTimeout(update, 300);
}

/** Bottom inset when mobile keyboard is open (visualViewport API). Also publishes layout CSS vars. */
export default function useVisualViewportInset(enabled = true) {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.visualViewport) return undefined;

    const root = document.documentElement;
    const vv = window.visualViewport;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const open = inset > KEYBOARD_THRESHOLD;
      const nextInset = open ? inset : 0;

      root.style.setProperty('--ga-vv-height', `${Math.round(vv.height)}px`);
      root.style.setProperty('--ga-vv-offset-top', `${Math.round(vv.offsetTop)}px`);
      root.style.setProperty('--ga-keyboard-inset', `${nextInset}px`);

      setBottomInset(nextInset);
      recalculateSafeAreaInsets();
    };

    const onForeground = () => scheduleViewportUpdate(update);
    const onVisibility = () => {
      if (!document.hidden) onForeground();
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('pageshow', onForeground);
    window.addEventListener('focus', onForeground);
    document.addEventListener('visibilitychange', onVisibility);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('pageshow', onForeground);
      window.removeEventListener('focus', onForeground);
      document.removeEventListener('visibilitychange', onVisibility);
      root.style.removeProperty('--ga-vv-height');
      root.style.removeProperty('--ga-vv-offset-top');
      root.style.removeProperty('--ga-keyboard-inset');
    };
  }, [enabled]);

  return bottomInset;
}
