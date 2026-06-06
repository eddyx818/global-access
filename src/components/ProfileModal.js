import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ProfileModal({ user, form, setForm, userType, setUserType, onClose }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inputStyle = {
    width: '100%', background: '#F8F6F3', border: '0.5px solid #E0DDD8',
    borderRadius: 8, padding: '11px 12px', color: '#1A1A1A', fontSize: 13,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
  };
  const labelStyle = {
    fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6,
    letterSpacing: '0.06em', textTransform: 'uppercase'
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        email: user.email,
        name: form.name,
        company: form.company,
        phone: form.phone,
        user_type: userType,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (_) {}
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: '#FFF', borderRadius: 20, padding: '2rem', maxWidth: 440, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: '#1A1A1A' }}>My Profile</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#AAA', cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
        </div>

        {/* Account type */}
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
