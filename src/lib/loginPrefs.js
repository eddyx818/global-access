const REMEMBER_KEY = 'ga-remember-login';
const EMAIL_KEY = 'ga-saved-email';
const PASSWORD_KEY = 'ga-saved-password';

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

export function getRememberLogin() {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function getSavedLogin() {
  if (!getRememberLogin()) return null;
  try {
    const email = localStorage.getItem(EMAIL_KEY) || '';
    const password = localStorage.getItem(PASSWORD_KEY) || '';
    if (!email || !password) return null;
    return { email, password };
  } catch (_) {
    return null;
  }
}

export function saveLogin({ email, password, remember }) {
  if (!canUseStorage()) return;
  try {
    if (remember && email && password) {
      localStorage.setItem(REMEMBER_KEY, '1');
      localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
      localStorage.setItem(PASSWORD_KEY, password);
    } else {
      clearSavedLogin();
    }
  } catch (_) {}
}

export function clearSavedLogin() {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(PASSWORD_KEY);
  } catch (_) {}
}
