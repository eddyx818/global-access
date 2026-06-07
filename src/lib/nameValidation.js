const VOWELS = /[aeiouy]/i;
const CONSONANTS = /[bcdfghjklmnpqrstvwxz]/i;

const RESERVED_USERNAMES = new Set([
  'admin', 'support', 'globalaccess', 'staff', 'help', 'system', 'root', 'moderator',
]);

function letterRunFails(letters) {
  if (/(.)\1{3,}/.test(letters)) return true;
  let consonantRun = 0;
  for (const ch of letters) {
    if (CONSONANTS.test(ch)) {
      consonantRun += 1;
      if (consonantRun >= 5) return true;
    } else {
      consonantRun = 0;
    }
  }
  if (letters.length >= 8) {
    const unique = new Set(letters.split('')).size;
    if (unique / letters.length < 0.35) return true;
  }
  return false;
}

export function validatePersonName(value, { label = 'Name', minLen = 2, maxLen = 80 } = {}) {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < minLen) {
    return { ok: false, error: `${label} must be at least ${minLen} characters.` };
  }
  if (trimmed.length > maxLen) {
    return { ok: false, error: `${label} is too long.` };
  }
  if (!/^[\p{L}\p{M}'.\-\s]+$/u.test(trimmed)) {
    return { ok: false, error: `${label} can only include letters, spaces, hyphens, and apostrophes.` };
  }
  const letters = trimmed.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (letters.length >= 4 && !VOWELS.test(letters)) {
    return { ok: false, error: `Please enter a real ${label.toLowerCase()}.` };
  }
  if (letters.length >= 4 && letterRunFails(letters)) {
    return { ok: false, error: `Please enter a real ${label.toLowerCase()}.` };
  }
  return { ok: true, value: trimmed };
}

export function validateCompanyName(value) {
  const trimmed = (value || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2) {
    return { ok: false, error: 'Company name must be at least 2 characters.' };
  }
  if (trimmed.length > 120) {
    return { ok: false, error: 'Company name is too long.' };
  }
  if (!/^[\p{L}\p{M}0-9'.\-&\s]+$/u.test(trimmed)) {
    return { ok: false, error: 'Company name has invalid characters.' };
  }
  const letters = trimmed.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (letters.length >= 4 && !VOWELS.test(letters)) {
    return { ok: false, error: 'Please enter a real company or store name.' };
  }
  if (letters.length >= 4 && letterRunFails(letters)) {
    return { ok: false, error: 'Please enter a real company or store name.' };
  }
  return { ok: true, value: trimmed };
}

export function validateUsername(value) {
  const clean = (value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (clean.length < 3) {
    return { ok: false, error: 'Username must be at least 3 characters (letters, numbers, underscore).' };
  }
  if (clean.length > 24) {
    return { ok: false, error: 'Username is too long (max 24 characters).' };
  }
  if (!/^[a-z][a-z0-9_]*$/.test(clean)) {
    return { ok: false, error: 'Username must start with a letter and use only letters, numbers, or underscores.' };
  }
  if (RESERVED_USERNAMES.has(clean)) {
    return { ok: false, error: 'This username is reserved.' };
  }
  const letters = clean.replace(/_/g, '');
  if (letters.length >= 4 && letterRunFails(letters)) {
    return { ok: false, error: 'Please choose a clearer username.' };
  }
  return { ok: true, value: clean };
}
