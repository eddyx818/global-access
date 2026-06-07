import { clearAppNavigation } from './appNavigation';

const PROCESS_KEY = 'ga-app-process';

let coldLaunch = false;

/**
 * Detect full app close (swipe off / X) vs background (call, switch app).
 * sessionStorage survives background; cleared on true unload via pagehide.
 */
export function initAppSession() {
  const wasRunning = sessionStorage.getItem(PROCESS_KEY) === '1';
  coldLaunch = !wasRunning;

  if (coldLaunch) {
    clearAppNavigation();
  }

  sessionStorage.setItem(PROCESS_KEY, '1');

  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      sessionStorage.removeItem(PROCESS_KEY);
    }
  });
}

/** True when the app was fully closed and reopened (not just backgrounded). */
export function isColdAppLaunch() {
  return coldLaunch;
}

/** True when returning from background — restore last screen. */
export function isSessionResumable() {
  return !coldLaunch;
}

export const APP_SESSION_HINT =
  'Switching apps or taking a call keeps you where you left off. Fully closing Global Access (swipe it off your app switcher) starts fresh at sign-in — unless Remember me is checked.';
