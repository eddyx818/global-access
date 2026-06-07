export const THEMES = { DAY: 'day', NIGHT: 'night' };

const STORAGE_KEY = 'ga-theme';

export function getStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === THEMES.DAY || saved === THEMES.NIGHT) return saved;
  } catch (_) {}
  return THEMES.DAY;
}

export function setStoredTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (_) {}
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const next = theme === THEMES.NIGHT ? THEMES.NIGHT : THEMES.DAY;
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next === THEMES.NIGHT ? 'dark' : 'light';
}

/** Shortcuts for inline styles — values are CSS custom properties */
export const t = {
  bg: 'var(--ga-bg)',
  bgElevated: 'var(--ga-bg-elevated)',
  bgMuted: 'var(--ga-bg-muted)',
  bgSubtle: 'var(--ga-bg-subtle)',
  bgHover: 'var(--ga-bg-hover)',
  text: 'var(--ga-text)',
  textSecondary: 'var(--ga-text-secondary)',
  textMuted: 'var(--ga-text-muted)',
  textFaint: 'var(--ga-text-faint)',
  textDisabled: 'var(--ga-text-disabled)',
  border: 'var(--ga-border)',
  borderLight: 'var(--ga-border-light)',
  borderSubtle: 'var(--ga-border-subtle)',
  borderHairline: '0.5px solid var(--ga-border)',
  borderHairlineLight: '0.5px solid var(--ga-border-light)',
  accent: 'var(--ga-accent)',
  accentDark: 'var(--ga-accent-dark)',
  accentBg: 'var(--ga-accent-bg)',
  accentBorder: 'var(--ga-accent-border)',
  gold: 'var(--ga-gold)',
  goldBg: 'var(--ga-gold-bg)',
  navBg: 'var(--ga-nav-bg)',
  navBorder: 'var(--ga-nav-border)',
  bottomNavBg: 'var(--ga-bottom-nav-bg)',
  overlay: 'var(--ga-overlay)',
  overlayLight: 'var(--ga-overlay-light)',
  shadow: 'var(--ga-shadow)',
  inputBg: 'var(--ga-input-bg)',
  btnPrimaryBg: 'var(--ga-btn-primary-bg)',
  btnPrimaryText: 'var(--ga-btn-primary-text)',
  headerBg: 'var(--ga-header-bg)',
  headerText: 'var(--ga-header-text)',
  headerMuted: 'var(--ga-header-muted)',
  warningBg: 'var(--ga-warning-bg)',
  warningBorder: 'var(--ga-warning-border)',
  warningText: 'var(--ga-warning-text)',
  errorBg: 'var(--ga-error-bg)',
  errorBorder: 'var(--ga-error-border)',
  errorText: 'var(--ga-error-text)',
  successBg: 'var(--ga-success-bg)',
  successBorder: 'var(--ga-success-border)',
  successText: 'var(--ga-success-text)',
  bubbleMineBg: 'var(--ga-bubble-mine-bg)',
  bubbleMineText: 'var(--ga-bubble-mine-text)',
  bubbleOtherBg: 'var(--ga-bubble-other-bg)',
  bubbleOtherText: 'var(--ga-bubble-other-text)',
  browseBannerBg: 'var(--ga-browse-banner-bg)',
  browseBannerBorder: 'var(--ga-browse-banner-border)',
  browseBannerText: 'var(--ga-browse-banner-text)',
};
