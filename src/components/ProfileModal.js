import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { saveProfile, checkUsernameAvailable, isProfileComplete } from '../lib/community';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/notificationPrefs';
import { playMessageSound, vibrateDevice } from '../lib/messageAlerts';
import { subscribeToPushNotifications, isPushSupported } from '../lib/pushNotifications';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

function splitAppointment(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

function combineAppointment(date, time) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [error, setError] = useState('');
  const [notifyPrefs, setNotifyPrefs] = useState(getNotificationPrefs);
  const [notifyPerm, setNotifyPerm] = useState(getNotificationPermission);

  useEffect(() => {
    if (!user?.id) return;
    const applyProfileExtras = (data) => {
      if (!data) return;
      setUsername(data.username || '');
      setBio(data.bio || '');
      setAvatarUrl(data.profile_avatar_url || '');
      setAppointmentNotes(data.appointment_notes || '');
      const { date, time } = splitAppointment(data.preferred_appointment_at);
      setAppointmentDate(date);
      setAppointmentTime(time);
    };

    supabase.from('user_profiles')
      .select('username, bio, profile_avatar_url, preferred_appointment_at, appointment_notes')
      .eq('user_id', user.id)
      .single()
      .then(async ({ data, error }) => {
        if (data) {
          applyProfileExtras(data);
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
  const needsDetails = profileGate === 'chat' && !isProfileComplete(form);

  const toggleNotify = (key, value) => {
    const next = { ...notifyPrefs, [key]: value };
    setNotifyPrefs(next);
    saveNotificationPrefs(next);
  };

  const enablePush = async () => {
    const result = await requestNotificationPermission();
    setNotifyPerm(result);
    if (result === 'granted') {
      toggleNotify('notifications', true);
      await subscribeToPushNotifications(user?.id);
    }
  };

  const testAlert = () => {
    if (notifyPrefs.sound) playMessageSound();
    if (notifyPrefs.vibrate) vibrateDevice();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    if (profileGate === 'chat' && !isProfileComplete(form)) {
      setError('Please add your name, company, and phone to use Support chat.');
      setSaving(false);
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername) {
      const ok = await checkUsernameAvailable(cleanUsername, user.id);
      if (!ok) { setError('Username is already taken.'); setSaving(false); return; }
    }

    const appointmentAt = combineAppointment(appointmentDate, appointmentTime);

    try {
      const result = await saveProfile(user.id, user.email, {
        username: cleanUsername || null,
        name: form.name,
        company: form.company,
        phone: form.phone,
        bio: bio.trim() || null,
        profile_avatar_url: avatarUrl.trim() || null,
        ...(isStaff ? {} : { user_type: userType, role: userType }),
        preferred_appointment_at: appointmentAt,
        appointment_notes: appointmentNotes.trim() || null,
      });
      if (!result.ok) {
        const hint = result.error?.includes('phone')
          ? ' Run supabase-update-26-profile-columns.sql in Supabase, then try again.'
          : '';
        setError(`Could not save profile.${hint ? ` ${hint}` : result.error ? ` (${result.error})` : ''}`);
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
          Add your business details below to start Support chat. We will save them for future visits.
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
        <label style={labelStyle}>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname" style={inputStyle} autoCapitalize="none" />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Avatar URL</label>
        <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." style={inputStyle} autoCapitalize="none" />
      </div>

      {isStaff ? (
        <details style={{ marginBottom: '1.25rem', ...sectionStyle, padding: '12px 14px' }}>
          <summary style={{ fontSize: 12, fontWeight: 600, color: t.text, cursor: 'pointer' }}>
            Preview portal as customer type
          </summary>
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, margin: '10px 0 12px' }}>
            Switch how the portal looks for browsing only. This does not change your admin account.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['retailer', 'distributor'].map(typeKey => (
              <button key={typeKey} type="button" onClick={() => setUserType(typeKey)}
                style={{ flex: 1, background: userType === typeKey ? t.btnPrimaryBg : t.inputBg, color: userType === typeKey ? t.btnPrimaryText : t.textMuted, border: userType === typeKey ? `0.5px solid ${t.btnPrimaryBg}` : t.borderHairline, borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', fontWeight: userType === typeKey ? 600 : 400 }}>
                {typeKey}
              </button>
            ))}
          </div>
        </details>
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
          />
        </div>
      ))}

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Notes for our team</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Optional notes about your business..."
          style={{ ...inputStyle, height: 72, resize: 'none' }} />
      </div>

      <div style={sectionStyle}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Schedule a call (optional)</div>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: 12 }}>
          Pick a date and time if you would like us to reach out to discuss your order or account.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={appointmentDate} min={new Date().toISOString().slice(0, 10)}
              onChange={e => setAppointmentDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Time</label>
            <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <label style={labelStyle}>Appointment notes</label>
        <textarea value={appointmentNotes} onChange={e => setAppointmentNotes(e.target.value)}
          placeholder="What would you like to discuss?" style={{ ...inputStyle, height: 64, resize: 'none' }} />
      </div>

      <div style={sectionStyle}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Message alerts</div>
        <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: 12 }}>
          Sound, vibration, and badge when you receive chat messages.
        </div>
        {[
          ['sound', 'Sound'],
          ['vibrate', 'Vibrate (mobile)'],
          ['badge', 'App icon badge'],
        ].map(([key, label]) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!notifyPrefs[key]} onChange={e => toggleNotify(key, e.target.checked)} />
            {label}
          </label>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, color: t.textSecondary, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!notifyPrefs.notifications && notifyPerm === 'granted'}
            disabled={notifyPerm === 'denied' || notifyPerm === 'unsupported'}
            onChange={e => toggleNotify('notifications', e.target.checked)}
          />
          Push notifications
        </label>
        {notifyPerm === 'default' && (
          <button type="button" onClick={enablePush}
            style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
            Allow notifications
          </button>
        )}
        {notifyPerm === 'granted' && isPushSupported() && (
          <div style={{ fontSize: 11, color: t.successText, marginBottom: 8 }}>
            Push enabled — you will get banners when the app is in the background.
          </div>
        )}
        {notifyPerm === 'granted' && !isPushSupported() && (
          <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>
            In-app alerts work here. For background banners on iPhone, install the app from Safari and allow notifications.
          </div>
        )}
        {notifyPerm === 'denied' && (
          <div style={{ fontSize: 11, color: t.errorText, marginBottom: 8 }}>Notifications blocked in browser settings.</div>
        )}
        <button type="button" onClick={testAlert}
          style={{ background: t.bgElevated, color: t.textSecondary, border: t.borderHairline, borderRadius: 8, padding: '7px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
          Test sound & vibrate
        </button>
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
        <div style={{ marginBottom: '1rem', padding: '10px 14px', background: t.successBg, borderRadius: 10, border: `0.5px solid ${t.successBorder}`, fontSize: 12, color: t.successText }}>
          App installed on this device
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
          padding: '14px 16px',
          paddingTop: 'max(14px, var(--ga-inset-top))',
          borderBottom: t.borderHairlineLight,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: t.headerBg,
          flexShrink: 0,
        }}>
          <button type="button" onClick={onClose} aria-label="Back"
            style={{ background: 'none', border: 'none', color: t.headerText, cursor: 'pointer', fontSize: 22, padding: '4px 8px 4px 0', fontFamily: 'inherit', lineHeight: 1 }}>
            ‹
          </button>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.headerText }}>My Profile</div>
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '1.25rem 1rem calc(1rem + var(--ga-inset-bottom))',
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
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: t.text }}>My Profile</div>
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
