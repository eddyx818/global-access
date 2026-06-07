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

export async function resendSignupConfirmation(email) {
  const { supabase } = await import('./supabase');
  return supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
  });
}
