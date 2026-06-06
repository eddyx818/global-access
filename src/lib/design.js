export const FONT_STYLES = {
  modern: "'DM Sans', sans-serif",
  bold: "'Bebas Neue', sans-serif",
  elegant: "'Playfair Display', serif",
  playful: "'Pacifico', cursive",
};

export const DEFAULT_GLOBAL_STYLES = {
  primary_color: '#1A1A1A',
  secondary_color: '#4CAF7D',
  font_family: 'modern',
  button_style: 'rounded',
};

export const BUTTON_RADIUS = { rounded: 14, pill: 20, square: 6 };

export function getFontFamily(fontStyle) {
  return FONT_STYLES[fontStyle] || FONT_STYLES.modern;
}

export function getButtonRadius(buttonStyle) {
  return BUTTON_RADIUS[buttonStyle] ?? BUTTON_RADIUS.rounded;
}

export function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function validateHexColor(color, fieldName) {
  if (color && !HEX_COLOR.test(color)) throw new Error(`Invalid ${fieldName}: use #RRGGBB format`);
}
