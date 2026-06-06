import { createClient } from '@supabase/supabase-js';
import { getPortalSessionToken } from './session';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : supabase;

export const getSessionId = async () => getPortalSessionToken();

export const trackEvent = async (type, page, extra = {}) => {
  try {
    const sessionId = await getPortalSessionToken();
    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_type: type,
      page,
      ...extra,
      created_at: new Date().toISOString(),
    });
    await supabase.from('user_activity').insert({
      user_id: extra.user_id || null,
      session_token: sessionId,
      event_type: type,
      page_url: page,
      metadata: { element: extra.element, value: extra.value },
      created_at: new Date().toISOString(),
    });
  } catch (_) {}
};
