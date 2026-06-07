import { whatsAppUrl } from './whatsapp';

/** Business WhatsApp for customers — set REACT_APP_SUPPORT_WHATSAPP (not your personal email). */
export function getSupportWhatsAppPhone() {
  return (process.env.REACT_APP_SUPPORT_WHATSAPP || '').replace(/\D/g, '');
}

export function hasSupportWhatsApp() {
  return getSupportWhatsAppPhone().length >= 10;
}

export function getSupportWhatsAppLink(message = '') {
  const phone = process.env.REACT_APP_SUPPORT_WHATSAPP || '';
  return whatsAppUrl(phone, message);
}
