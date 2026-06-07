export const NIGHT_PAGE_BG = '#0F0F12';
export const DEFAULT_PAGE_BG = '#F5F2ED';

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 245, g: 242, b: 237 };
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 || Number.isNaN(parseInt(h, 16))) return { r: 245, g: 242, b: 237 };
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function mixHex(a, b, ratio) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const t = Math.max(0, Math.min(1, ratio));
  const ch = (x, y) => Math.round(x + (y - x) * t);
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(ch(A.r, B.r))}${toHex(ch(A.g, B.g))}${toHex(ch(A.b, B.b))}`;
}

/** Contrast-aware watermark color + opacity for brand page backgrounds. */
export function getPatternAppearance(brandColor, pageBg, { isNight = false, isMobile = false } = {}) {
  const bg = isNight ? NIGHT_PAGE_BG : (pageBg || DEFAULT_PAGE_BG);
  const brandLum = relativeLuminance(brandColor || '#C9A84C');
  const bgLum = relativeLuminance(bg);
  const darkBrand = brandLum < 0.38;
  const darkBg = bgLum < 0.35 || isNight;

  let color = brandColor || '#C9A84C';
  let opacity = isMobile ? 0.1 : 0.09;

  if (darkBrand && darkBg) {
    color = mixHex(brandColor, '#FFFFFF', 0.75);
    opacity = isMobile ? 0.16 : 0.14;
  } else if (darkBrand && !darkBg) {
    color = mixHex(brandColor, '#1A1A1A', 0.4);
    opacity = isMobile ? 0.1 : 0.085;
  } else if (!darkBrand && darkBg) {
    opacity = isMobile ? 0.15 : 0.12;
  } else if (bgLum > 0.88) {
    opacity = isMobile ? 0.11 : 0.1;
  }

  return {
    color,
    opacity: Math.min(0.18, opacity),
    pageBg: bg,
  };
}

export function getPatternDensity(label, isMobile) {
  const len = Math.max((label || '').length, 4);
  return {
    repeatsPerRow: isMobile ? Math.max(6, Math.ceil(56 / len)) : Math.max(10, Math.ceil(96 / len)),
    rowCount: isMobile ? 24 : 28,
  };
}

/** Sample watermark styling for admin background previews. */
export function getSamplePatternForBg(bgHex, sampleBrandColor = '#C9A84C') {
  const bgLum = relativeLuminance(bgHex);
  const isDarkBg = bgLum < 0.35;
  return getPatternAppearance(sampleBrandColor, bgHex, { isNight: isDarkBg, isMobile: false });
}
