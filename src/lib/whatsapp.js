const FAKE_EXACT = new Set([
  '1234567890', '0987654321', '0123456789',
  '1111111111', '2222222222', '3333333333', '4444444444',
  '5555555555', '6666666666', '7777777777', '8888888888', '9999999999',
  '0000000000', '1212121212', '1010101010', '1231231234', '3213213210',
]);

export function whatsAppUrl(phone, message = '') {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Opens WhatsApp to this number — on mobile, tap the call icon in WhatsApp for voice. */
export function whatsAppContactUrl(phone) {
  return whatsAppUrl(phone, '');
}

/** Opens WhatsApp chat with a prefilled message (optional for staff outreach). */
export function whatsAppVoiceChatUrl(phone, contextLabel = 'Global Access') {
  const message = `Hi! We were chatting on ${contextLabel} — I'd like to continue by voice call when you're free.`;
  return whatsAppUrl(phone, message);
}

export function normalizePhoneDigits(phone) {
  return (phone || '').replace(/\D/g, '');
}

function nationalNumber(digits) {
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function isAllSameDigit(digits) {
  return digits.length >= 10 && /^(\d)\1+$/.test(digits);
}

function isTrivialSequence(digits) {
  if (digits.length < 10) return false;
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i += 1) {
    const prev = Number(digits[i - 1]);
    const curr = Number(digits[i]);
    if (curr !== prev + 1) ascending = false;
    if (curr !== prev - 1) descending = false;
  }
  return ascending || descending;
}

function isRepeatingShortPattern(digits) {
  for (const size of [2, 3, 4]) {
    if (digits.length % size !== 0 || digits.length < 10) continue;
    const chunk = digits.slice(0, size);
    if (chunk.repeat(digits.length / size) === digits) return true;
  }
  return false;
}

/** US/Canada NANP — area code and exchange cannot start with 0 or 1. */
function isValidNanp(n10) {
  if (n10.length !== 10) return true;
  const areaFirst = n10[0];
  const exchangeFirst = n10[3];
  if (areaFirst === '0' || areaFirst === '1') return false;
  if (exchangeFirst === '0' || exchangeFirst === '1') return false;
  if (n10.startsWith('55501')) return false;
  return true;
}

/**
 * Free client-side checks — rejects obvious placeholders, not proof of ownership.
 * SMS OTP would be needed to truly verify the number.
 */
export function validatePhone(phone) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 10) {
    return { ok: false, error: 'Enter at least 10 digits for your mobile number.' };
  }
  if (digits.length > 15) {
    return { ok: false, error: 'That phone number looks too long.' };
  }

  const national = nationalNumber(digits);
  const candidates = new Set([digits, national]);

  for (const value of candidates) {
    if (FAKE_EXACT.has(value)) {
      return { ok: false, error: 'Please enter your real mobile number — placeholders are not accepted.' };
    }
    if (isAllSameDigit(value)) {
      return { ok: false, error: 'Please enter your real mobile number — placeholders are not accepted.' };
    }
    if (isTrivialSequence(value)) {
      return { ok: false, error: 'Please enter your real mobile number — placeholders are not accepted.' };
    }
    if (isRepeatingShortPattern(value)) {
      return { ok: false, error: 'Please enter your real mobile number — placeholders are not accepted.' };
    }
  }

  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    if (!isValidNanp(national)) {
      return { ok: false, error: 'Please enter a valid US/Canada area code and number.' };
    }
  }

  return { ok: true, error: null };
}

export function hasCallablePhone(phone) {
  return validatePhone(phone).ok;
}

export function getPhoneValidationError(phone) {
  return validatePhone(phone).error;
}
