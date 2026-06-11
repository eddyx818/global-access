import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { saveProfile, checkUsernameAvailable, isProfileComplete } from '../lib/community';
import { getPhoneValidationError } from '../lib/accessRequestGate';
import { validatePersonName, validateCompanyName, validateUsername } from '../lib/nameValidation';
import { useTheme } from '../context/ThemeContext';
import { PHONE_PLACEHOLDER } from '../lib/catalogPricing';
import { APP_SESSION_HINT } from '../lib/appSession';
import ThemeToggle from './ThemeToggle';
import AddressFields, { EMPTY_ADDRESS } from './AddressFields';
import { normalizeAddressParts } from '../lib/addressFormat';

export default function ProfileModal({
  user,
  form,
  setForm,
  userType,
  setUserType,
  isStaff = false,
  onClose,
  variant = 'modal',
  profileGate = null,
  onSaved,
  pwa = {},
}) {
  const isPage = variant === 'page';
  const { t } = useTheme();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [addressParts, setAddressParts] = useState({ ...EMPTY_ADDRESS });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const applyProfileExtras = (data) => {
      if (!data) return;
      setUsername(data.username || '');
      setBio(data.bio || '');
      setAvatarUrl(data.profile_avatar_url || '');
    };

    supabase.from('user_profiles')
      .select('username, bio, profile_avatar_url, address, address_line2, city, state, zip, lat, lng')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data, error }) => {
        if (data) {
          applyProfileExtras(data);
          setAddressParts(normalizeAddressParts({
            address_line1: data.address,
            address_line2: data.address_line2,
            city: data.city,
            state: data.state,
            zip: data.zip,
            lat: data.lat,
            lng: data.lng,
          }));
          return;
        }
        if (!error) return;
        const { data: basic } = await supabase.from('user_profiles')
          .select('username, bio, profile_avatar_url')
          .eq('user_id', user.id)
          .single();
        applyProfileExtras(basic);
      });
  }, [user?.id]);

  const inputStyle = {
    width: '100%', background: t.inputBg, border: t.borderHairline,
    borderRadius: 8, padding: '11px 12px', color: t.text, fontSize: 16,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle = {
    fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6,
    letterSpacing: '0.06em', textTransform: 'uppercase',
  };
  const sectionStyle = {
    marginBottom: '1rem', padding: '14px 16px', background: t.bgMuted,
    borderRadius: 12, border: t.borderHairlineLight,
  };

  const { canInstall = false, showIosHint = false, isInstalled = false, install, isMobileDevice = false } = pwa;
  const showInstallInSettings = isMobileDevice && !isInstalled && (canInstall || showIosHint);
  const needsDetails = profileGate && !isProfileComplete(form);
  const profileGateMessage = 'Please add your name, company, and phone to request a quote.';

  const handleSave = async () => {
    setSaving(true);
    setError('');

    if (!isStaff && !isProfileComplete(form)) {
      const phoneErr = getPhoneValidationError(form.phone);
      setError(profileGate
        ? profileGateMessage
        : (phoneErr || 'Please add your name, company, and a real mobile number.'));
      setSaving(false);
      return;
    }

    const nameCheck = validatePersonName(form.name, { label: 'Full name' });
    if (!nameCheck.ok) { setError(nameCheck.error); setSaving(false); return; }
    const companyCheck = validateCompanyName(form.company);
    if (!companyCheck.ok) { setError(companyCheck.error); setSaving(false); return; }

    const usernameCheck = validateUsername(username);
    if (!isStaff && !usernameCheck.ok) {
      setError(usernameCheck.error);
      setSaving(false);
      return;
    }
    let cleanUsername = null;
    if (!isStaff) {
      cleanUsername = usernameCheck.value;
    } else if (username.trim()) {
      if (!usernameCheck.ok) {
        setError(usernameCheck.error);
        setSaving(false);
        return;
      }
      cleanUsername = usernameCheck.value;
    }
    if (cleanUsername) {
      const ok = await checkUsernameAvailable(cleanUsername, user.id);
      if (!ok) { setError('Username is already taken.'); setSaving(false); return; }
    }

    try {
      const result = await saveProfile(user.id, user.email, {
        username: cleanUsername,
        name: nameCheck.value,
        company: companyCheck.value,
        phone: form.phone,
        bio: bio.trim() || null,
        profile_avatar_url: avatarUrl.trim() || null,
        ...(!isStaff ? { user_type: userType, role: userType } : {}),
        ...(!isStaff ? {
          address: addressParts.address_line1?.trim() || null,
          address_line2: addressParts.address_line2?.trim() || null,
          city: addressParts.city?.trim() || null,
          state: addressParts.state?.trim() || null,
          zip: addressParts.zip?.trim() || null,
          lat: addressParts.lat,
          lng: addressParts.lng,
        } : {}),
      });
      if (!result.ok) {
        const dupUser = /username|unique|duplicate/i.test(result.error || '');
        const hint = result.error?.includes('phone')
          ? ' Run supabase-update-26-profile-columns.sql in Supabase, then try again.'
          : '';
        setError(dupUser
          ? 'Username is already taken.'
          : `Could not save profile.${hint ? ` ${hint}` : result.error ? ` (${result.error})` : ''}`);
        setSaving(false);
        return;
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onSaved?.({ profileComplete: isProfileComplete(form) });
        if (!isPage) onClose();
      }, isPage ? 800 : 1500);
    } catch (err) {
      setError(err?.message || 'Could not save profile.');
    }
    setSaving(false);
  };

  const formBody = (
    <>
      {needsDetails && (
        <div style={{ background: t.warningBg, border: `0.5px solid ${t.warningBorder}`, borderRadius: 10, padding: '12px 14px', marginBottom: '1rem', fontSize: 13, color: t.warningText, lineHeight: 1.5 }}>
          {profileGateMessage} We will save them for future visits.
        </div>
      )}

      {isStaff ? (
        <div style={{ ...sectionStyle, marginBottom: '1rem' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.gold, fontWeight: 700, marginBottom: 6 }}>
            Staff account
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
            This is your team profile — not a customer account. Use the Quotes tab in the catalog or Dashboard next to Sign out for leads and pricing.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: '1rem', padding: '0 2px' }}>
          Customer account — your team uses this info for quotes and WhatsApp follow-up.
        </div>
      )}

      <div style={sectionStyle}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Appearance</div>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: 12 }}>
          Day mode is the default. Night mode uses a darker palette across the portal.
        </div>
        <ThemeToggle fullWidth />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Username{!isStaff ? ' *' : ''}</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname" style={inputStyle} autoCapitalize="none" />
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6, lineHeight: 1.45 }}>
          Unique handle for signing in.
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Avatar URL</label>
        <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." style={inputStyle} autoCapitalize="none" />
      </div>

      {isStaff ? (
        <div style={{ ...sectionStyle, marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Preview portal as customer</div>
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: 12 }}>
            Browse brands and pricing as a retailer or distributor without leaving the portal. This only changes what you see — not your admin account.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['retailer', 'distributor'].map(typeKey => (
              <button key={typeKey} type="button" onClick={() => setUserType(typeKey)}
                style={{ flex: 1, background: userType === typeKey ? t.btnPrimaryBg : t.inputBg, color: userType === typeKey ? t.btnPrimaryText : t.textMuted, border: userType === typeKey ? `0.5px solid ${t.btnPrimaryBg}` : t.borderHairline, borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', fontWeight: userType === typeKey ? 600 : 400 }}>
                {typeKey}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>Account Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['retailer', 'distributor'].map(typeKey => (
              <button key={typeKey} type="button" onClick={() => setUserType(typeKey)}
                style={{ flex: 1, background: userType === typeKey ? t.btnPrimaryBg : t.inputBg, color: userType === typeKey ? t.btnPrimaryText : t.textMuted, border: userType === typeKey ? `0.5px solid ${t.btnPrimaryBg}` : t.borderHairline, borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', fontWeight: userType === typeKey ? 600 : 400 }}>
                {typeKey}
              </button>
            ))}
          </div>
        </div>
      )}

      {[['name', 'Full Name *'], ['company', 'Company / Store *'], ['phone', 'Phone / WhatsApp *'], ['email', 'Email']].map(([field, label]) => (
        <div key={field} style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>{label}</label>
          <input
            value={form[field] || ''}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            disabled={field === 'email'}
            style={{ ...inputStyle, opacity: field === 'email' ? 0.5 : 1 }}
            autoCapitalize={field === 'email' ? 'none' : 'words'}
            inputMode={field === 'phone' ? 'tel' : field === 'email' ? 'email' : 'text'}
            placeholder={field === 'phone' ? PHONE_PLACEHOLDER : undefined}
          />
        </div>
      ))}

      {!isStaff && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Business address</div>
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: 12 }}>
            Optional — helps us place you on the partner map. City and state are saved separately for contact lists.
          </div>
          <AddressFields
            value={addressParts}
            onChange={setAddressParts}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            isMobile={isPage}
          />
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>{isStaff ? 'Internal notes' : 'Notes for our team'}</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder={isStaff ? 'Optional internal notes…' : 'Optional notes about your business…'}
          style={{ ...inputStyle, height: 72, resize: 'none' }} />
      </div>

      {showInstallInSettings && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Install app</div>
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: 10 }}>
            {showIosHint && !canInstall
              ? 'On iPhone: tap Share in Safari, then Add to Home Screen.'
              : 'Add Global Access to your home screen for full-screen mobile use.'}
          </div>
          {canInstall && (
            <button type="button" onClick={install}
              style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Install on this device
            </button>
          )}
        </div>
      )}

      {isInstalled && isMobileDevice && (
        <div style={{ marginBottom: '1rem', padding: '10px 14px', background: t.successBg, borderRadius: 10, border: `0.5px solid ${t.successBorder}`, fontSize: 12, color: t.successText, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>App installed on this device</div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>{APP_SESSION_HINT}</div>
        </div>
      )}

      {error && <div style={{ background: t.errorBg, border: `0.5px solid ${t.errorBorder}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: t.errorText, marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: isPage ? '0.5rem' : '1.5rem', paddingBottom: isPage ? 8 : 0 }}>
        {!isPage && (
          <button type="button" onClick={onClose} style={{ flex: 1, background: 'none', border: t.borderHairline, borderRadius: 10, padding: '12px', fontSize: 13, color: t.textFaint, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        )}
        <button type="button" onClick={handleSave} disabled={saving}
          style={{ flex: isPage ? 1 : 2, background: saving ? t.border : t.btnPrimaryBg, color: saving ? t.textFaint : t.btnPrimaryText, border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          {saved ? '✓ Saved!' : saving ? 'Saving...' : (needsDetails ? 'Save & continue' : 'Save Profile')}
        </button>
      </div>
    </>
  );

  if (isPage) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: t.bgElevated,
        overflow: 'hidden',
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: 'max(8px, var(--ga-inset-top)) 1rem calc(1rem + var(--ga-inset-bottom))',
        }}>
          {formBody}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: t.overlay, zIndex: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.bgElevated, borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%',
          maxHeight: '90vh', overflowY: 'auto', boxShadow: `0 24px 64px ${t.shadow}`,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem',
          position: 'sticky', top: 0, background: t.bgElevated, zIndex: 1, paddingBottom: 8,
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: t.text }}>{isStaff ? 'Staff Profile' : 'My Profile'}</div>
          <button type="button" onClick={onClose} aria-label="Close profile"
            style={{ background: t.bgMuted, border: 'none', borderRadius: 8, fontSize: 22, color: t.textSecondary, cursor: 'pointer', fontFamily: 'inherit', width: 40, height: 40, lineHeight: 1 }}>
            ×
          </button>
        </div>
        {formBody}
      </div>
    </div>
  );
}
