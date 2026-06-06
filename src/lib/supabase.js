import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client for user management (requires service role key in Vercel env vars)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : supabase;

export const getSessionId = () => {
  let sid = sessionStorage.getItem('ga_session');
  if (!sid) {
    sid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('ga_session', sid);
  }
  return sid;
};

export const trackEvent = async (type, page, extra = {}) => {
  try {
    await supabase.from('analytics_events').insert({
      session_id: getSessionId(),
      event_type: type,
      page,
      ...extra,
      created_at: new Date().toISOString(),
    });
  } catch (_) {}
};
