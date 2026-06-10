import { useLayoutEffect } from 'react';

/** Marks top/bottom chrome inert while mobile chat compose is active (iOS single-field mode). */
export default function useMobileChatComposeLock({ enabled, active, inThread }) {
  useLayoutEffect(() => {
    if (!enabled || !inThread) return undefined;

    const chrome = document.querySelectorAll('nav.app-portal-nav, .app-top-chrome, .app-bottom-nav');
    chrome.forEach((el) => {
      el.inert = active;
    });

    return () => {
      chrome.forEach((el) => {
        el.inert = false;
      });
    };
  }, [enabled, active, inThread]);
}
