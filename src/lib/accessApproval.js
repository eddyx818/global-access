import { supabaseAdmin } from './supabase';

function randomPassword() {
  return `${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}!`;
}

export async function approveAccessRequestAndCreateAccount(req) {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Admin service key not configured (REACT_APP_SUPABASE_SERVICE_KEY).' };
  }
  if (!req?.email) {
    return { ok: false, error: 'Request is missing an email address.' };
  }

  const email = req.email.trim().toLowerCase();
  const tempPassword = randomPassword();
  const accountType = req.account_type || 'retailer';

  let userId = req.linked_user_id || null;

  if (!userId) {
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.user_id) {
      userId = existingProfile.user_id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { email_confirm: true });
    } else {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: req.name,
          company: req.company,
          role: accountType,
        },
      });
      if (authErr) {
        return { ok: false, error: authErr.message };
      }
      userId = authData.user.id;
    }
  }

  const now = new Date().toISOString();
  const { error: profileErr } = await supabaseAdmin.from('user_profiles').upsert({
    user_id: userId,
    email,
    name: req.name || null,
    company: req.company || null,
    phone: req.phone || null,
    role: accountType,
    user_type: accountType,
    referred_by_user_id: req.referred_by_user_id || null,
    referral_code_used: req.referral_code_used || null,
    admin_authorized: true,
    admin_authorized_at: now,
    updated_at: now,
  }, { onConflict: 'user_id' });

  if (profileErr) {
    return { ok: false, error: profileErr.message };
  }

  await supabaseAdmin.from('access_requests').update({
    status: 'approved',
    linked_user_id: userId,
  }).eq('id', req.id);

  const portalUrl = window.location.origin;

  return {
    ok: true,
    userId,
    email,
    tempPassword: req.linked_user_id ? null : tempPassword,
    portalUrl,
    whatsAppMessage: `Hi ${req.name || 'there'}! Your Global Access account is ready.\n\nPortal: ${portalUrl}\nEmail: ${email}${tempPassword ? `\nTemp password: ${tempPassword}\n\nPlease log in and update your profile.` : '\n\nLog in with your existing password.'}`,
  };
}
