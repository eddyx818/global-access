import { clearAppNavigation } from './appNavigation';

const PROCESS_KEY = 'ga-app-process';
const HEARTBEAT_KEY = 'ga-app-heartbeat';
/** Background resume window — iOS PWAs often reload the page when returning from background. */
const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15000;

let coldLaunch = false;

function touchHeartbeat() {
  try {
    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
  } catch (_) {}
}

/**
 * Detect full app close (swipe off / X) vs background (call, switch app).
 * Do not clear session on pagehide — iOS fires it when backgrounding and caused false resets.
 */
export function initAppSession() {
  const sessionRunning = sessionStorage.getItem(PROCESS_KEY) === '1';
  let heartbeat = 0;
  try {
    heartbeat = Number(localStorage.getItem(HEARTBEAT_KEY) || 0);
  } catch (_) {}
  const recentlyActive = heartbeat > 0 && (Date.now() - heartbeat) < RESUME_WINDOW_MS;

  coldLaunch = !sessionRunning && !recentlyActive;

  if (coldLaunch) {
    clearAppNavigation();
  }

  sessionStorage.setItem(PROCESS_KEY, '1');
  touchHeartbeat();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      touchHeartbeat();
      sessionStorage.setItem(PROCESS_KEY, '1');
    }
  });

  window.setInterval(() => {
    if (!document.hidden) touchHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);
}

/** Clear session markers on sign-out or intentional full reset. */
export function clearAppSession() {
  sessionStorage.removeItem(PROCESS_KEY);
  try {
    localStorage.removeItem(HEARTBEAT_KEY);
  } catch (_) {}
  clearAppNavigation();
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
