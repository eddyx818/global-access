const KEY = 'ga-notify-prefs';

const DEFAULTS = {
  sound: true,
  vibrate: true,
  notifications: true,
  badge: true,
};

export function getNotificationPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

export function saveNotificationPrefs(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getNotificationPrefs(), ...prefs }));
  } catch (_) {}
}

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}
