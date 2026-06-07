import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { validateAccessCode } from '../lib/repCodes';
import { setPortalReferral, getPortalReferral } from '../lib/session';
import { getRememberLogin, getSavedLogin, saveLogin, clearSavedLogin } from '../lib/loginPrefs';
import { emailVerificationRequired, isEmailVerified, resendSignupConfirmation, canAccessPortal, fetchProfileAccess } from '../lib/authGate';
import { isValidRequestEmail, isHoneypotClean, canSubmitAccessRequest } from '../lib/accessRequestGate';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
 
const STORE_TYPES = {
  retailer: ['Smoke Shop', 'Convenience Store', 'Liquor Store', 'Vape Shop', 'CBD Shop', 'Dispensary', 'Gas Station', 'Other'],
  distributor: ['Regional Distributor', 'National Distributor', 'Wholesale', 'Broker', 'Other'],
};
 
export default function LoginScreen({ onCodeVerified, onLoggedIn, onRequestAccess, onAdminEntry, showLogin }) {
  const { t } = useTheme();
  const [mode, setMode] = useState(showLogin ? 'login' : 'gate');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [reqForm, setReqForm] = useState({
    name: '', company: '', email: '', phone: '',
    account_type: 'retailer', store_type: '', address: '',
    location_count: '1', has_retail: false, retail_count: '1',
    website: '',
  });
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(getRememberLogin);
  const [regForm, setRegForm] = useState({ username: '', email: '', password: '', name: '', company: '', account_type: 'retailer' });

  useEffect(() => {
    const saved = getSavedLogin();
    if (saved) {
      setEmail(saved.email);
      setPassword(saved.password);
      setRememberMe(true);
    }
  }, []);
 
  const inputStyle = { width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8, padding: '11px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelStyle = { fontSize: 11, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 };
  const btnPrimary = { width: '100%', background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1rem' };
  const btnAdmin = {
    width: '100%',
    background: t.goldBg,
    color: t.gold,
    border: `0.5px solid ${t.gold}`,
    borderRadius: 8,
    padding: '12px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '0.75rem',
  };

  const btnLink = { background: 'none', border: 'none', fontSize: 12, color: t.textFaint, cursor: 'pointer', padding: 0, fontFamily: 'inherit' };

  const goAdminLogin = () => {
    onAdminEntry?.();
    setMode('login');
    setError('');
  };
 
  const handleCode = async () => {
    if (!code.trim()) {
      setError('Please enter an access code.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await validateAccessCode(code);
    if (result.valid) {
      if (result.type === 'rep') {
        await setPortalReferral({ repUserId: result.repUserId, code: result.code });
      }
      onCodeVerified(result);
      setMode('login');
    } else {
      setError('Incorrect access code. Ask your rep for their personal code, or request access below.');
    }
    setLoading(false);
  };
 
  const handleLogin = async () => {
    setLoading(true); setError(''); setPendingVerifyEmail('');
    const trimmedEmail = email.trim().toLowerCase();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    if (err) {
      setLoading(false);
      setError('Invalid email or password.');
      return;
    }
    const accessProfile = await fetchProfileAccess(data.user.id);
    if (!canAccessPortal(data.user, accessProfile)) {
      await supabase.auth.signOut();
      setPendingVerifyEmail(trimmedEmail);
      setLoading(false);
      setError('Please verify your email before signing in, or wait until an admin authorizes your account.');
      return;
    }
    setLoading(false);
    if (rememberMe) {
      saveLogin({ email: trimmedEmail, password, remember: true });
    } else {
      clearSavedLogin();
    }
    onLoggedIn(data.user);
  };

  const handleResendVerification = async () => {
    if (!pendingVerifyEmail) return;
    setLoading(true);
    setError('');
    const { error: err } = await resendSignupConfirmation(pendingVerifyEmail);
    setLoading(false);
    if (err) setError('Could not resend verification email. Try again in a few minutes.');
    else setSuccess('Verification email sent — check your inbox.');
  };
 
  const handleReset = async () => {
    if (!resetEmail.trim()) { setError('Please enter your email.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), { redirectTo: window.location.origin });
    setLoading(false);
    if (err) setError('Could not send reset email.');
    else { setSuccess('Reset email sent! Check your inbox.'); setError(''); }
  };
 
  const handleRequest = async () => {
    if (!reqForm.name || !reqForm.company || !reqForm.email) {
      setError('Please fill in name, company, and email.');
      return;
    }
    if (!isValidRequestEmail(reqForm.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!isHoneypotClean(reqForm)) {
      setSuccess("Request sent! We'll reach out within 1 business day.");
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    const gate = await canSubmitAccessRequest(reqForm.email);
    if (!gate.ok) {
      setLoading(false);
      setError(gate.error);
      return;
    }
    await onRequestAccess(reqForm);
    setLoading(false);
    setSuccess("Request sent! We'll reach out within 1 business day.");
    setError('');
  };
 
  const handleRegister = async () => {
    if (!regForm.email || !regForm.password || !regForm.name) {
      setError('Email, password, and name are required.');
      return;
    }
    if (regForm.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true); setError('');
    const cleanUsername = regForm.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername) {
      const { data: taken } = await supabase.from('user_profiles').select('user_id').eq('username', cleanUsername).maybeSingle();
      if (taken) { setError('Username is already taken.'); setLoading(false); return; }
    }
    const { data, error: err } = await supabase.auth.signUp({
      email: regForm.email.trim().toLowerCase(),
      password: regForm.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: regForm.name, company: regForm.company, role: regForm.account_type },
      },
    });
    if (err) { setError(err.message); setLoading(false); return; }
    if (data.user) {
      const referral = await getPortalReferral();
      await supabase.from('user_profiles').upsert({
        user_id: data.user.id,
        email: regForm.email.trim().toLowerCase(),
        username: cleanUsername || null,
        name: regForm.name,
        company: regForm.company,
        role: regForm.account_type,
        user_type: regForm.account_type,
        status: 'online',
        referred_by_user_id: referral?.referral_rep_id || null,
        referral_code_used: referral?.referral_code || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (emailVerificationRequired() && !data.session) {
        setPendingVerifyEmail(regForm.email.trim().toLowerCase());
        setSuccess('Account created! Verify your email or wait for admin approval, then sign in.');
      } else {
        setSuccess('Account created! You can sign in now.');
      }
      setMode('login');
    }
    setLoading(false);
  };

  const setReg = (field, val) => setRegForm(f => ({ ...f, [field]: val }));

  const setReq = (field, val) => setReqForm(f => ({ ...f, [field]: val }));
 
  return (
    <div className="app-login-screen" style={{ background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", padding: '1.5rem', paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))', transition: 'background 0.35s ease' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: mode === 'request' ? 480 : 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.3em', color: t.textFaint, textTransform: 'uppercase', marginBottom: 10 }}>Trade Portal</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: '0.06em', color: t.text, lineHeight: 1 }}>Global Access</div>
          <div style={{ width: 36, height: 2, background: t.gold, margin: '14px auto 0', borderRadius: 1 }} />
        </div>

        <div style={{ background: t.bgElevated, border: t.borderHairline, borderRadius: 14, padding: '2rem', boxShadow: `0 4px 24px ${t.shadow}` }}>
 
          {/* GATE */}
          {mode === 'gate' && (
            <>
              <p style={{ fontSize: 13, color: t.textMuted, marginBottom: '1.5rem', lineHeight: 1.6 }}>Enter your access code or sign in with your account. Your sales rep may have given you a personal code.</p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Access Code</label>
                <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCode()} placeholder="Enter code" style={inputStyle} autoCapitalize="none" />
              </div>
              {error && <ErrBox msg={error} />}
              <button onClick={handleCode} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>{loading ? 'Checking…' : 'Continue →'}</button>
              <Divider />
              <button onClick={() => setMode('login')} style={{ ...btnPrimary, background: t.bgElevated, color: t.text, border: t.borderHairline }}>Sign In with Account</button>
              <div style={{ textAlign: 'center', marginTop: 8 }}><button onClick={() => setMode('register')} style={btnLink}>Create an account</button></div>
              <div style={{ textAlign: 'center' }}><button onClick={() => setMode('request')} style={btnLink}>Don't have access? Request it</button></div>
              <button type="button" onClick={goAdminLogin} style={btnAdmin}>Admin Dashboard →</button>
            </>
          )}
 
          {/* LOGIN */}
          {mode === 'login' && (
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="you@company.com" style={inputStyle} autoCapitalize="none" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} type={showPassword ? 'text' : 'password'} placeholder="••••••••" style={{ ...inputStyle, paddingRight: 44 }} />
                  <button onClick={() => setShowPassword(s => !s)} type="button"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#AAA', padding: 0, fontFamily: 'inherit' }}>
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setRememberMe(next);
                    if (!next) clearSavedLogin();
                  }}
                />
                Remember me on this device
              </label>
              {error && <ErrBox msg={error} />}
              {pendingVerifyEmail && (
                <button type="button" onClick={handleResendVerification} disabled={loading} style={{ ...btnPrimary, background: t.bgElevated, color: t.text, border: t.borderHairline, marginBottom: '0.75rem', opacity: loading ? 0.7 : 1 }}>
                  Resend verification email
                </button>
              )}
              <button onClick={handleLogin} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>{loading ? 'Signing in...' : 'Sign In →'}</button>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setMode('reset')} style={btnLink}>Forgot password?</button>
                <button onClick={() => setMode('request')} style={btnLink}>Request access</button>
              </div>
              <button type="button" onClick={goAdminLogin} style={{ ...btnAdmin, marginTop: '1rem' }}>
                Admin Dashboard →
              </button>
            </>
          )}
 
          {/* RESET */}
          {mode === 'reset' && (
            <>
              <p style={{ fontSize: 13, color: '#888', marginBottom: '1.25rem' }}>Enter your email and we'll send a reset link.</p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Email</label>
                <input value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@company.com" style={inputStyle} autoCapitalize="none" />
              </div>
              {error && <ErrBox msg={error} />}
              {success && <OkBox msg={success} />}
              <button onClick={handleReset} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>{loading ? 'Sending...' : 'Send Reset Email'}</button>
              <div style={{ textAlign: 'center' }}><button onClick={() => setMode('login')} style={btnLink}>← Back to sign in</button></div>
            </>
          )}
 
          {/* REGISTER */}
          {mode === 'register' && (
            <>
              <p style={{ fontSize: 13, color: '#888', marginBottom: '1.25rem', lineHeight: 1.6 }}>Create your Global Access account.</p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Username</label>
                <input value={regForm.username} onChange={e => setReg('username', e.target.value)} placeholder="yourname" style={inputStyle} autoCapitalize="none" />
              </div>
              {[['name', 'Full name *'], ['company', 'Company'], ['email', 'Email *'], ['password', 'Password * (6+ chars)']].map(([field, label]) => (
                <div key={field} style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>{label}</label>
                  <input value={regForm[field]} onChange={e => setReg(field, e.target.value)} type={field === 'password' ? 'password' : 'text'} style={inputStyle} autoCapitalize={field === 'email' ? 'none' : 'words'} />
                </div>
              ))}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Account type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['retailer', 'distributor'].map(t => (
                    <button key={t} onClick={() => setReg('account_type', t)}
                      style={{ flex: 1, padding: '10px', border: `0.5px solid ${regForm.account_type === t ? '#1A1A1A' : '#E0DDD8'}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: regForm.account_type === t ? '#1A1A1A' : '#F8F6F3', color: regForm.account_type === t ? '#FFF' : '#888', textTransform: 'capitalize' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {error && <ErrBox msg={error} />}
              {success && <OkBox msg={success} />}
              {pendingVerifyEmail && mode === 'register' && (
                <button type="button" onClick={handleResendVerification} disabled={loading} style={{ ...btnPrimary, background: t.bgElevated, color: t.text, border: t.borderHairline, marginBottom: '0.75rem', opacity: loading ? 0.7 : 1 }}>
                  Resend verification email
                </button>
              )}
              <button onClick={handleRegister} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>{loading ? 'Creating...' : 'Create Account →'}</button>
              <div style={{ textAlign: 'center' }}><button onClick={() => setMode('login')} style={btnLink}>← Back to sign in</button></div>
            </>
          )}

          {/* REQUEST ACCESS — full form */}
          {mode === 'request' && (
            <>
              <p style={{ fontSize: 13, color: '#888', marginBottom: '1.25rem', lineHeight: 1.6 }}>Tell us about your business. We'll review and reach out within 1 business day.</p>

              <input type="text" name="website" value={reqForm.website} onChange={e => setReq('website', e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }} />
 
              {/* Account type toggle */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>I am a *</label>
                <div style={{ display: 'flex', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, overflow: 'hidden' }}>
                  {['retailer', 'distributor'].map(type => (
                    <button key={type} onClick={() => setReq('account_type', type)}
                      style={{ flex: 1, padding: '11px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: reqForm.account_type === type ? 600 : 400, background: reqForm.account_type === type ? '#1A1A1A' : 'transparent', color: reqForm.account_type === type ? '#FFF' : '#888', transition: 'all 0.15s', textTransform: 'capitalize' }}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
 
              {/* Basic info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                {[['name', 'Your name *'], ['company', 'Business name *']].map(([field, label]) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    <input value={reqForm[field]} onChange={e => setReq(field, e.target.value)} style={inputStyle} autoCapitalize="words" />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
                {[['email', 'Email *'], ['phone', 'Phone / WhatsApp']].map(([field, label]) => (
                  <div key={field}>
                    <label style={labelStyle}>{label}</label>
                    <input value={reqForm[field]} onChange={e => setReq(field, e.target.value)} style={inputStyle} autoCapitalize={field === 'email' ? 'none' : 'words'} />
                  </div>
                ))}
              </div>
 
              {/* Store type */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Type of {reqForm.account_type} *</label>
                <select value={reqForm.store_type} onChange={e => setReq('store_type', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select type...</option>
                  {(STORE_TYPES[reqForm.account_type] || []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
 
              {/* Address */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Primary Business Address</label>
                <input value={reqForm.address} onChange={e => setReq('address', e.target.value)} placeholder="123 Main St, City, State, ZIP" style={inputStyle} />
                <div style={{ fontSize: 11, color: '#CCC', marginTop: 4 }}>Just your main address — we don't need every location</div>
              </div>
 
              {/* Location count */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>How many {reqForm.account_type === 'retailer' ? 'store' : 'warehouse'} locations?</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['1', '2-5', '6-10', '10+'].map(n => (
                    <button key={n} onClick={() => setReq('location_count', n)}
                      style={{ flex: 1, padding: '9px 4px', border: `0.5px solid ${reqForm.location_count === n ? '#1A1A1A' : '#E0DDD8'}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: reqForm.location_count === n ? '#1A1A1A' : '#F8F6F3', color: reqForm.location_count === n ? '#FFF' : '#888', fontWeight: reqForm.location_count === n ? 600 : 400, transition: 'all 0.15s' }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
 
              {/* Distributor retail stores question */}
              {reqForm.account_type === 'distributor' && (
                <div style={{ background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>Do you also operate retail store locations?</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: reqForm.has_retail ? 12 : 0 }}>
                    {[['Yes', true], ['No', false]].map(([label, val]) => (
                      <button key={label} onClick={() => setReq('has_retail', val)}
                        style={{ flex: 1, padding: '9px', border: `0.5px solid ${reqForm.has_retail === val ? '#C9A84C' : '#E0DDD8'}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, background: reqForm.has_retail === val ? 'rgba(201,168,76,0.12)' : '#FFF', color: reqForm.has_retail === val ? '#A07A20' : '#888', fontWeight: reqForm.has_retail === val ? 600 : 400, transition: 'all 0.15s' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {reqForm.has_retail && (
                    <div>
                      <label style={labelStyle}>How many retail locations?</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {['1', '2-5', '6-10', '10+'].map(n => (
                          <button key={n} onClick={() => setReq('retail_count', n)}
                            style={{ flex: 1, padding: '8px 4px', border: `0.5px solid ${reqForm.retail_count === n ? '#C9A84C' : '#E0DDD8'}`, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, background: reqForm.retail_count === n ? 'rgba(201,168,76,0.12)' : '#FFF', color: reqForm.retail_count === n ? '#A07A20' : '#888', transition: 'all 0.15s' }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
 
              {error && <ErrBox msg={error} />}
              {success && <OkBox msg={success} />}
              {!success && (
                <button onClick={handleRequest} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Sending...' : 'Request Access →'}
                </button>
              )}
              <div style={{ textAlign: 'center' }}><button onClick={() => setMode('gate')} style={btnLink}>← Back</button></div>
            </>
          )}
        </div>
        <ThemeToggle compact />
        <p style={{ textAlign: 'center', fontSize: 12, color: t.textDisabled, marginTop: '1rem' }}>Global Access · Trade portal · Invite only</p>
      </div>
    </div>
  );
}
 
const ErrBox = ({ msg }) => <div style={{ background: 'var(--ga-error-bg)', border: '0.5px solid var(--ga-error-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--ga-error-text)', marginBottom: '1rem' }}>{msg}</div>;
const OkBox = ({ msg }) => <div style={{ background: 'var(--ga-success-bg)', border: '0.5px solid var(--ga-success-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--ga-success-text)', marginBottom: '1rem' }}>{msg}</div>;
const Divider = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0.75rem 0' }}>
    <div style={{ flex: 1, height: '0.5px', background: 'var(--ga-border)' }} />
    <span style={{ fontSize: 11, color: 'var(--ga-text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>or</span>
    <div style={{ flex: 1, height: '0.5px', background: '#E0DDD8' }} />
  </div>
);