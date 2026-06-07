import { supabase } from './supabase';
import { hasCallablePhone, getPhoneValidationError } from './whatsapp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPhone(phone) {
  return hasCallablePhone(phone);
}

export { getPhoneValidationError };

export function isValidRequestEmail(email) {
  return EMAIL_RE.test((email || '').trim().toLowerCase());
}

/** Honeypot field — bots often fill hidden inputs. */
export function isHoneypotClean(form) {
  return !(form?.website || form?._hp || '').trim();
}

export function normalizeRequestEmail(email) {
  return (email || '').trim().toLowerCase();
}

/** Block duplicate accounts and repeat pending requests (DB-backed). */
export async function canSubmitAccessRequest(email) {
  const normalized = normalizeRequestEmail(email);
  if (!normalized) return { ok: false, error: 'Email is required.' };

  try {
    const { data, error } = await supabase.rpc('check_signup_email', { p_email: normalized });
    if (error) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('access_requests')
        .select('id', { count: 'exact', head: true })
        .eq('email', normalized)
        .gte('created_at', since);
      if ((count || 0) > 0) {
        return {
          ok: false,
          code: 'pending_request',
          error: 'We already received a request from this email. Check your status in the waiting room.',
        };
      }
      return { ok: true };
    }

    const row = typeof data === 'object' && data !== null ? data : {};
    if (row.has_account) {
      return {
        ok: false,
        code: 'account_exists',
        error: 'An account already exists for this email. Sign in instead of requesting access again.',
      };
    }
    if (row.request_status === 'pending') {
      return {
        ok: false,
        code: 'pending_request',
        error: 'We already have a pending request for this email. Check status in the waiting room.',
      };
    }
  } catch (_) {}

  return { ok: true };
}

export async function fetchAccessRequestStatus(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'Email required.' };

  try {
    const { data, error } = await supabase.rpc('get_access_request_status', { p_email: normalized });
    if (error) return { ok: false, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ok: true, status: null };
    return { ok: true, status: row.status, createdAt: row.created_at };
  } catch (err) {
    return { ok: false, error: err.message || 'Could not check status.' };
  }
}

export const PENDING_ACCESS_KEY = 'ga_pending_access';

export function savePendingAccess({ email, name }) {
  try {
    localStorage.setItem(PENDING_ACCESS_KEY, JSON.stringify({
      email: (email || '').trim().toLowerCase(),
      name: (name || '').trim(),
      savedAt: Date.now(),
    }));
  } catch (_) {}
}

export function readPendingAccess() {
  try {
    const raw = localStorage.getItem(PENDING_ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function clearPendingAccess() {
  try {
    localStorage.removeItem(PENDING_ACCESS_KEY);
  } catch (_) {}
}
