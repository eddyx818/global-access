import { supabaseAdmin } from './supabase';
import { revokePortalAuthorization } from './authGate';

function randomPassword() {
  return `${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 4).toUpperCase()}!`;
}

async function sendWelcomeEmail({ email, name, tempPassword, portalUrl }) {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) return { ok: false, skipped: 'not configured' };

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-access-welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        name,
        temp_password: tempPassword || null,
        portal_url: portalUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'Welcome email failed' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Welcome email failed' };
  }
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
        if (/already|registered|exists/i.test(authErr.message || '')) {
          return { ok: false, error: 'An account already exists for this email.' };
        }
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
  const emailResult = await sendWelcomeEmail({
    email,
    name: req.name,
    tempPassword: req.linked_user_id ? null : tempPassword,
    portalUrl,
  });

  return {
    ok: true,
    userId,
    email,
    tempPassword: req.linked_user_id ? null : tempPassword,
    portalUrl,
    welcomeEmailSent: emailResult.ok === true,
    welcomeEmailError: emailResult.error || null,
    whatsAppMessage: `Hi ${req.name || 'there'}! Your Global Access account is ready.\n\nPortal: ${portalUrl}\nEmail: ${email}${tempPassword ? `\nTemp password: ${tempPassword}\n\nPlease log in and update your profile.` : '\n\nLog in with your existing password.'}`,
  };
}

export async function denyAccessRequest(req) {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Admin service key not configured (REACT_APP_SUPABASE_SERVICE_KEY).' };
  }
  if (!req?.id) {
    return { ok: false, error: 'Request not found.' };
  }

  if (req.linked_user_id) {
    const revoked = await revokePortalAuthorization(req.linked_user_id);
    if (!revoked.ok) {
      return { ok: false, error: revoked.error || 'Could not revoke portal access.' };
    }
  }

  const { error } = await supabaseAdmin
    .from('access_requests')
    .update({ status: 'denied' })
    .eq('id', req.id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function setAccessRequestDismissed(id, dismissed) {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Admin service key not configured (REACT_APP_SUPABASE_SERVICE_KEY).' };
  }
  const { error } = await supabaseAdmin
    .from('access_requests')
    .update({ dismissed_at: dismissed ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteAccessRequest(id) {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Admin service key not configured (REACT_APP_SUPABASE_SERVICE_KEY).' };
  }
  if (!id) {
    return { ok: false, error: 'Request not found.' };
  }
  const { error } = await supabaseAdmin
    .from('access_requests')
    .delete()
    .eq('id', id);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
