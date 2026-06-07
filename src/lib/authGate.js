/** Email must be verified before portal access (disable with REACT_APP_REQUIRE_EMAIL_VERIFICATION=false). */
export function emailVerificationRequired() {
  return process.env.REACT_APP_REQUIRE_EMAIL_VERIFICATION !== 'false';
}

export function isEmailVerified(user) {
  if (!user?.email) return false;
  if (user.email_confirmed_at) return true;
  if (user.confirmed_at) return true;
  const emailIdentity = (user.identities || []).find(i => i.provider === 'email');
  if (emailIdentity?.identity_data?.email_verified) return true;
  return false;
}

export function isAdminAuthorized(profile) {
  return profile?.admin_authorized === true;
}

/** Portal access — customers need admin approval; staff need verified email or admin flag. */
export function canAccessPortal(user, profile) {
  if (!emailVerificationRequired()) return true;
  const isStaff = profile?.is_portal_admin === true
    || profile?.is_sales_rep === true
    || profile?.role === 'admin'
    || profile?.role === 'sales_rep';
  if (isStaff) {
    return isEmailVerified(user) || isAdminAuthorized(profile);
  }
  return isAdminAuthorized(profile);
}

export async function fetchProfileAccess(userId) {
  const { supabase } = await import('./supabase');
  const { data } = await supabase
    .from('user_profiles')
    .select('admin_authorized, admin_authorized_at, is_portal_admin, is_sales_rep, role')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function authorizePortalAccess(userId, { confirmEmail = true } = {}) {
  const { supabaseAdmin } = await import('./supabase');
  if (!supabaseAdmin) {
    return { ok: false, error: 'Admin service key not configured (REACT_APP_SUPABASE_SERVICE_KEY).' };
  }
  if (confirmEmail) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });
    if (authErr) return { ok: false, error: authErr.message };
  }
  const now = new Date().toISOString();
  const { error: profileErr } = await supabaseAdmin
    .from('user_profiles')
    .update({ admin_authorized: true, admin_authorized_at: now, updated_at: now })
    .eq('user_id', userId);
  if (profileErr) return { ok: false, error: profileErr.message };
  return { ok: true };
}

export async function revokePortalAuthorization(userId) {
  const { supabaseAdmin } = await import('./supabase');
  if (!supabaseAdmin) {
    return { ok: false, error: 'Admin service key not configured (REACT_APP_SUPABASE_SERVICE_KEY).' };
  }
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update({ admin_authorized: false, admin_authorized_at: null, updated_at: now })
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resendSignupConfirmation(email) {
  const { supabase } = await import('./supabase');
  return supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
  });
}

/** Map email or username to the auth email used for sign-in. */
export async function resolveLoginEmail(identifier) {
  const trimmed = (identifier || '').trim().toLowerCase();
  if (!trimmed) return { ok: false, error: 'Email or username is required.' };
  if (trimmed.includes('@')) return { ok: true, email: trimmed };

  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.rpc('resolve_login_email', { p_identifier: trimmed });
  if (error || !data) {
    return { ok: false, error: 'No account found for that username.' };
  }
  return { ok: true, email: String(data).trim().toLowerCase() };
}
