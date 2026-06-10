import { useEffect, useLayoutEffect } from 'react';

/** Locks page scroll and top/bottom chrome while mobile chat compose is active. */
export default function useMobileChatComposeLock({ enabled, active, inThread }) {
  useLayoutEffect(() => {
    if (!enabled || !inThread) return undefined;

    const root = document.documentElement;
    const chrome = document.querySelectorAll('nav.app-portal-nav, .app-top-chrome, .app-bottom-nav');

    root.classList.toggle('chat-compose-active', active);
    chrome.forEach((el) => {
      el.inert = active;
    });

    return () => {
      root.classList.remove('chat-compose-active');
      chrome.forEach((el) => {
        el.inert = false;
      });
    };
  }, [enabled, active, inThread]);

  useEffect(() => {
    if (!enabled || !inThread || !active) return undefined;

    const allowScroll = (target) => target?.closest?.('.chat-message-thread');

    const blockTouchMove = (e) => {
      if (!allowScroll(e.target)) e.preventDefault();
    };

    const vv = window.visualViewport;
    const lockScroll = () => {
      window.scrollTo(0, 0);
    };

    document.addEventListener('touchmove', blockTouchMove, { passive: false });
    window.addEventListener('scroll', lockScroll, { passive: true });
    vv?.addEventListener('scroll', lockScroll);
    lockScroll();

    return () => {
      document.removeEventListener('touchmove', blockTouchMove);
      window.removeEventListener('scroll', lockScroll);
      vv?.removeEventListener('scroll', lockScroll);
    };
  }, [enabled, active, inThread]);
}
