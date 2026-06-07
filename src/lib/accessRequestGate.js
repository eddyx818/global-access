import { supabase } from './supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidRequestEmail(email) {
  return EMAIL_RE.test((email || '').trim().toLowerCase());
}

/** Honeypot field — bots often fill hidden inputs. */
export function isHoneypotClean(form) {
  return !(form?.website || form?._hp || '').trim();
}

/** Limit repeat access requests from the same email (client + DB check). */
export async function canSubmitAccessRequest(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { ok: false, error: 'Email is required.' };

  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('email', normalized)
      .gte('created_at', since);
    if (error) return { ok: true };
    if ((count || 0) > 0) {
      return { ok: false, error: 'We already received a request from this email recently. Our team will follow up soon.' };
    }
  } catch (_) {}

  return { ok: true };
}
