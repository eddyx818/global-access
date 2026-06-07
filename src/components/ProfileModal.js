import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { saveProfile, checkUsernameAvailable } from '../lib/community';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/notificationPrefs';
import { playMessageSound, vibrateDevice } from '../lib/messageAlerts';

export default function ProfileModal({ user, form, setForm, userType, setUserType, onClose }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [notifyPrefs, setNotifyPrefs] = useState(getNotificationPrefs);
  const [notifyPerm, setNotifyPerm] = useState(getNotificationPermission);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('user_profiles').select('username, bio, profile_avatar_url').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username || '');
          setBio(data.bio || '');
          setAvatarUrl(data.profile_avatar_url || '');
        }
      });
  }, [user?.id]);

  const inputStyle = {
    width: '100%', background: '#F8F6F3', border: '0.5px solid #E0DDD8',
    borderRadius: 8, padding: '11px 12px', color: '#1A1A1A', fontSize: 13,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
  };
  const labelStyle = {
    fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6,
    letterSpacing: '0.06em', textTransform: 'uppercase'
  };

  const toggleNotify = (key, value) => {
    const next = { ...notifyPrefs, [key]: value };
    setNotifyPrefs(next);
    saveNotificationPrefs(next);
  };

  const enablePush = async () => {
    const result = await requestNotificationPermission();
    setNotifyPerm(result);
    if (result === 'granted') toggleNotify('notifications', true);
  };

  const testAlert = () => {
    if (notifyPrefs.sound) playMessageSound();
    if (notifyPrefs.vibrate) vibrateDevice();
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername) {
      const ok = await checkUsernameAvailable(cleanUsername, user.id);
      if (!ok) { setError('Username is already taken.'); setSaving(false); return; }
    }
    try {
      await saveProfile(user.id, user.email, {
        username: cleanUsername || null,
        name: form.name,
        company: form.company,
        phone: form.phone,
        bio: bio.trim() || null,
        profile_avatar_url: avatarUrl.trim() || null,
        user_type: userType,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (_) {
      setError('Could not save profile.');
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: '#FFF', borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#1A1A1A' }}>My Profile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#AAA', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname" style={inputStyle} autoCapitalize="none" />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Avatar URL</label>
          <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." style={inputStyle} autoCapitalize="none" />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>Account Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['retailer', 'distributor'].map(t => (
              <button key={t} onClick={() => setUserType(t)}
                style={{ flex: 1, background: userType === t ? '#1A1A1A' : '#F8F6F3', color: userType === t ? '#FFF' : '#888', border: `0.5px solid ${userType === t ? '#1A1A1A' : '#E0DDD8'}`, borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', fontWeight: userType === t ? 600 : 400 }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {[['name', 'Full Name'], ['company', 'Company / Store'], ['phone', 'Phone / WhatsApp'], ['email', 'Email']].map(([field, label]) => (
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
          <label style={labelStyle}>Notes</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Optional notes for our team..."
            style={{ ...inputStyle, height: 72, resize: 'none' }} />
        </div>

        <div style={{ marginBottom: '1rem', padding: '14px 16px', background: '#F8F6F3', borderRadius: 12, border: '0.5px solid #E8E4DF' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>Message alerts</div>
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.45, marginBottom: 12 }}>
            Sound, vibration, and badge when you receive chat messages. Install the app for the best experience on mobile.
          </div>
          {[
            ['sound', 'Sound'],
            ['vibrate', 'Vibrate (mobile)'],
            ['badge', 'App icon badge'],
          ].map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!notifyPrefs[key]} onChange={e => toggleNotify(key, e.target.checked)} />
              {label}
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 13, color: '#555', cursor: 'pointer' }}>
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
              style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
              Allow notifications
            </button>
          )}
          {notifyPerm === 'denied' && (
            <div style={{ fontSize: 11, color: '#C53030', marginBottom: 8 }}>Notifications blocked in browser settings.</div>
          )}
          <button type="button" onClick={testAlert}
            style={{ background: '#FFF', color: '#555', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '7px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            Test sound & vibrate
          </button>
        </div>

        {error && <div style={{ background: '#FEF0F0', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C53030', marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: '1.5rem' }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: '0.5px solid #E0DDD8', borderRadius: 10, padding: '12px', fontSize: 13, color: '#AAA', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, background: saving ? '#E0DDD8' : '#1A1A1A', color: saving ? '#AAA' : '#FFF', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
