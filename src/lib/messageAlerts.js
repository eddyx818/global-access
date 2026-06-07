import { getNotificationPrefs } from './notificationPrefs';

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {}
  }
  return audioCtx;
}

export function playMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    [[880, t], [1175, t + 0.12]].forEach(([freq, start]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch (_) {}
}

export function vibrateDevice() {
  try {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  } catch (_) {}
}

export function setAppBadgeCount(count) {
  if (!('setAppBadge' in navigator)) return;
  try {
    if (count > 0) navigator.setAppBadge(count);
    else navigator.clearAppBadge();
  } catch (_) {}
}

export function showMessageNotification({ title, body, conversationId, onClick }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;

  try {
    const n = new Notification(title, {
      body: body?.slice(0, 180) || 'New message',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: conversationId ? `ga-chat-${conversationId}` : 'ga-chat',
      renotify: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
    return n;
  } catch (_) {
    return null;
  }
}

export function alertIncomingMessage({ title, body, conversationId, onClick, chatFocused = false }) {
  const prefs = getNotificationPrefs();
  const hidden = document.hidden;

  if (!chatFocused) {
    if (prefs.sound) playMessageSound();
    if (prefs.vibrate) vibrateDevice();
  }
  if (prefs.notifications && (hidden || !chatFocused)) {
    showMessageNotification({ title, body, conversationId, onClick });
  }
}
