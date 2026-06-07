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

/** Shared styles for admin dashboard panels */
export function getAdminUi() {
  return {
    page: {
      minHeight: '100vh',
      background: t.bg,
      fontFamily: "'DM Sans', sans-serif",
      color: t.text,
      transition: 'background 0.35s ease, color 0.35s ease',
    },
    header: {
      background: t.bgElevated,
      borderBottom: t.borderHairline,
      padding: '0 1.5rem',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    },
    card: {
      background: t.bgElevated,
      border: t.borderHairlineLight,
      borderRadius: 12,
      padding: '1.25rem',
    },
    statCard: {
      background: t.bgElevated,
      border: t.borderHairlineLight,
      borderRadius: 12,
      padding: '1rem',
    },
    sectionLabel: {
      fontSize: 12,
      color: t.textFaint,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    row: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: `0.5px solid ${t.borderSubtle}`,
      fontSize: 13,
    },
    input: {
      width: '100%',
      background: t.inputBg,
      border: t.borderHairline,
      borderRadius: 8,
      padding: '10px 12px',
      color: t.text,
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    tabBtn: (active) => ({
      background: active ? t.btnPrimaryBg : 'transparent',
      color: active ? t.btnPrimaryText : t.textMuted,
      border: active ? `0.5px solid ${t.btnPrimaryBg}` : t.borderHairline,
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 13,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontWeight: active ? 600 : 400,
    }),
  };
}
