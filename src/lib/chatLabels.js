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
