import { supabase } from './supabase';

const COOKIE_NAME = 'ga_sid';
const COOKIE_MAX_AGE_DAYS = 365;

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value) {
  const maxAge = COOKIE_MAX_AGE_DAYS * 86400;
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
}

function generateToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

let cachedToken = null;

export async function getPortalSessionToken() {
  if (cachedToken) return cachedToken;

  let token = readCookie(COOKIE_NAME);
  if (!token) {
    token = generateToken();
    writeCookie(COOKIE_NAME, token);
  }

  try {
    const { data: existing } = await supabase
      .from('portal_sessions')
      .select('session_token')
      .eq('session_token', token)
      .maybeSingle();

    if (!existing) {
      await supabase.from('portal_sessions').upsert({
        session_token: token,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: 'session_token' });
    } else {
      await supabase.from('portal_sessions').update({
        last_seen_at: new Date().toISOString(),
      }).eq('session_token', token);
    }
  } catch (_) {}

  cachedToken = token;
  return token;
}

export async function isPortalCodeVerified() {
  const token = await getPortalSessionToken();
  try {
    const { data } = await supabase
      .from('portal_sessions')
      .select('code_verified')
      .eq('session_token', token)
      .maybeSingle();
    return !!data?.code_verified;
  } catch (_) {
    return false;
  }
}

export async function setPortalCodeVerified(verified = true) {
  const token = await getPortalSessionToken();
  try {
    await supabase.from('portal_sessions').upsert({
      session_token: token,
      code_verified: verified,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'session_token' });
  } catch (_) {}
}

export async function setPortalReferral({ repUserId, code }) {
  const token = await getPortalSessionToken();
  try {
    await supabase.from('portal_sessions').upsert({
      session_token: token,
      referral_rep_id: repUserId || null,
      referral_code: code || null,
      code_verified: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'session_token' });
  } catch (_) {}
}

export async function getPortalReferral() {
  const token = await getPortalSessionToken();
  try {
    const { data } = await supabase
      .from('portal_sessions')
      .select('referral_rep_id, referral_code')
      .eq('session_token', token)
      .maybeSingle();
    return data || null;
  } catch (_) {
    return null;
  }
}

export async function linkPortalSessionToUser(userId) {
  const token = await getPortalSessionToken();
  try {
    await supabase.from('portal_sessions').update({
      user_id: userId,
      last_seen_at: new Date().toISOString(),
    }).eq('session_token', token);
  } catch (_) {}
}

export async function clearPortalSession() {
  cachedToken = null;
  document.cookie = `${COOKIE_NAME}=;path=/;max-age=0`;
}
