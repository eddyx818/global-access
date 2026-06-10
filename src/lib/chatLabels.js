/** Default nav label for buyers — change via Admin → Portal or REACT_APP_CUSTOMER_CHAT_LABEL */
export const DEFAULT_CUSTOMER_CHAT_LABEL = 'Trade Desk';

export function resolveCustomerChatLabel(siteSetting) {
  const fromEnv = (process.env.REACT_APP_CUSTOMER_CHAT_LABEL || '').trim();
  if (siteSetting && String(siteSetting).trim()) return String(siteSetting).trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_CUSTOMER_CHAT_LABEL;
}

export function staffChatLabel() {
  return 'Messages';
}

/** CTA button text — avoids awkward doubles like "Message Messages". */
export function customerChatActionLabel(chatLabel) {
  const label = (chatLabel || DEFAULT_CUSTOMER_CHAT_LABEL).trim() || DEFAULT_CUSTOMER_CHAT_LABEL;
  if (/^messages$/i.test(label)) return 'Open Messages';
  if (/^message[s]?\b/i.test(label)) return label;
  return `Message ${label}`;
}

/** Sign-in / browse hint — avoids "message Messages". */
export function customerChatSignInHint(chatLabel, { short = false } = {}) {
  const label = (chatLabel || DEFAULT_CUSTOMER_CHAT_LABEL).trim() || DEFAULT_CUSTOMER_CHAT_LABEL;
  if (/^messages$/i.test(label)) {
    return short
      ? 'Sign in to open Messages, or send a quote request from any brand.'
      : 'Sign in to open Messages, or request a quote from any brand page.';
  }
  const useLabel = short
    ? `Sign in to use ${label}, or send a quote request from any brand.`
    : `Sign in to use ${label}, or request a quote from any brand page.`;
  return useLabel;
}
