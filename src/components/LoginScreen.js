import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ACCESS_CODE } from '../lib/data';

const STORE_TYPES = {
  retailer: ['Smoke Shop', 'Convenience Store', 'Liquor Store', 'Vape Shop', 'CBD Shop', 'Dispensary', 'Gas Station', 'Other'],
  distributor: ['Regional Distributor', 'National Distributor', 'Wholesale', 'Broker', 'Other'],
};

export default function LoginScreen({ onCodeVerified, onLoggedIn, onRequestAccess, showLogin }) {
  const [mode, setMode] = useState(showLogin ? 'login' : 'gate');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [reqForm, setReqForm] = useState({
    name: '', company: '', email: '', phone: '',
    account_type: 'retailer', store_type: '', address: '',
    location_count: '1', has_retail: false, retail_count: '1',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const inputStyle = { width: '100%', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '11px 12px', color: '#1A1A1A', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const labelStyle = { fontSize: 11, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 };
  const btnPrimary = { width: '100%', background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1rem' };
  const btnLink = { background: 'none', border: 'none', fontSize: 12, color: '#AAA', cursor: 'pointer', padding: 0, fontFamily: 'inherit' };

  const handleCode = () => {
    if (code.trim().toLowerCase() === ACCESS_CODE.toLowerCase()) {
      onCodeVerified(); setMode('login'); setError('');
    } else {
      setError('Incorrect access code. Please try again or request access.');
    }
  };

  const handleLogin = async () => {
    setLoading(true); setError('');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (err) setError('Invalid email or password.');
    else onLoggedIn(data.user);
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
    setLoading(true);
    await onRequestAccess(reqForm);
    setLoading(false);
    setSuccess("Request sent! We'll reach out within 1 business day.");
    setError('');
  };

  const setReq = (field, val) => setReqForm(f => ({ ...f, [field]: val }));

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", padding: '1.5rem' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Bebas+Neue&display=swap" rel="stylesheet" />
      <div style={{ width: '100%', maxWidth: mode === 'request' ? 480 : 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#AAA', textTransform: 'uppercase', marginBottom: 10 }}>Trade Portal</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: '0.06em', color: '#1A1A1A', lineHeight: 1 }}>Global Access</div>
          <div style={{ width: 36, height: 2, background: '#C9A84C', margin: '14px auto 0', borderRadius: 1 }} />
        </div>

        <div style={{ background: '#FFF', border: '0.5px solid #E0DDD8', borderRadius: 14, padding: '2rem', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>

          {/* GATE */}
          {mode === 'gate' && (
            <>
              <p style={{ fontSize: 13, color: '#888', marginBottom: '1.5rem', lineHeight: 1.6 }}>Enter your access code or sign in with your account.</p>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Access Code</label>
                <input value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCode()} placeholder="Enter code" style={inputStyle} autoCapitalize="none" />
              </div>
              {error && <ErrBox msg={error} />}
              <button onClick={handleCode} style={btnPrimary}>Continue →</button>
              <Divider />
              <button onClick={() => setMode('login')} style={{ ...btnPrimary, background: '#FFF', color: '#1A1A1A', border: '0.5px solid #E0DDD8' }}>Sign In with Account</button>
              <div style={{ textAlign: 'center' }}><button onClick={() => setMode('request')} style={btnLink}>Don't have access? Request it</button></div>
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
                <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} type="password" placeholder="••••••••" style={inputStyle} />
              </div>
              {error && <ErrBox msg={error} />}
              <button onClick={handleLogin} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>{loading ? 'Signing in...' : 'Sign In →'}</button>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setMode('reset')} style={btnLink}>Forgot password?</button>
                <button onClick={() => setMode('request')} style={btnLink}>Request access</button>
              </div>
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

          {/* REQUEST ACCESS — full form */}
          {mode === 'request' && (
            <>
              <p style={{ fontSize: 13, color: '#888', marginBottom: '1.25rem', lineHeight: 1.6 }}>Tell us about your business. We'll review and reach out within 1 business day.</p>

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
        <p style={{ textAlign: 'center', fontSize: 12, color: '#CCC', marginTop: '1.5rem' }}>Global Access · Trade portal · Invite only</p>
      </div>
    </div>
  );
}

const ErrBox = ({ msg }) => <div style={{ background: '#FEF0F0', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C53030', marginBottom: '1rem' }}>{msg}</div>;
const OkBox = ({ msg }) => <div style={{ background: '#F0FAF4', border: '0.5px solid #C6EDD7', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2D7A50', marginBottom: '1rem' }}>{msg}</div>;
const Divider = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0.75rem 0' }}>
    <div style={{ flex: 1, height: '0.5px', background: '#E0DDD8' }} />
    <span style={{ fontSize: 11, color: '#CCC', textTransform: 'uppercase', letterSpacing: '0.1em' }}>or</span>
    <div style={{ flex: 1, height: '0.5px', background: '#E0DDD8' }} />
  </div>
);
