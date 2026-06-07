import React from 'react';
import { useTheme } from '../context/ThemeContext';

export function InterestView({ interests, toggleInterest, form, setForm, onSubmit, onBack, isMobile, profileSaved = false, chatLabel = 'Trade Desk' }) {
  const { t } = useTheme();
  const inputStyle = { width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8, padding: '11px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const lockedStyle = { ...inputStyle, opacity: 0.75, background: t.bgSubtle };

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: isMobile ? 'max(8px, var(--ga-inset-top)) 1rem 2rem' : '1.5rem 1.5rem 3rem' }}>
      {!isMobile && (
        <>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: t.textFaint, cursor: 'pointer', fontSize: 13, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit' }}>← Back</button>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, letterSpacing: '0.04em', color: t.text, marginBottom: 4 }}>Request a Quote</div>
        </>
      )}
      <div style={{ fontSize: 13, color: t.textMuted, marginBottom: '1.75rem', lineHeight: 1.6 }}>
        {profileSaved
          ? `Your saved details are below. Add notes for this quote — we will follow up in ${chatLabel} with pricing and availability.`
          : 'Tell us who you are and we will follow up with pricing and availability.'}
      </div>
      <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Selected items</div>
        {interests.length === 0 && <div style={{ fontSize: 13, color: t.textDisabled }}>No items selected.</div>}
        {interests.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
            <div>
              <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>{item.brandName} - {item.productName}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                {item.flavor} · SKU: {item.sku}
                {item.qty ? ` · Qty ${item.qty}${item.orderUnitLabel ? ` ${item.orderUnitLabel}` : ''}` : ''}
              </div>
            </div>
            <button onClick={() => toggleInterest(item.sku, item.productName, item.brandName, item.flavor)} style={{ background: 'none', border: 'none', color: t.textDisabled, cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
          {profileSaved ? 'Your saved details' : 'Your details'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[['name','Name *'],['company','Company / Store *'],['phone','Phone / WhatsApp *'],['email','Email']].map(([field, label]) => (
            <div key={field}>
              <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
              <input
                value={form[field] || ''}
                onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                readOnly={profileSaved && field !== 'email'}
                style={profileSaved && field !== 'email' ? lockedStyle : inputStyle}
                autoCapitalize={field === 'email' ? 'none' : 'words'}
                inputMode={field === 'phone' ? 'tel' : field === 'email' ? 'email' : 'text'}
              />
            </div>
          ))}
        </div>
        <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes for this inquiry</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Questions, timeline, or extra info for this order..."
          style={{ ...inputStyle, height: 80, resize: 'none' }} />
        {profileSaved && (
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>
            Update name, company, or phone anytime in Profile.
          </div>
        )}
      </div>
      <button onClick={onSubmit} disabled={interests.length === 0} style={{ width: '100%', background: interests.length > 0 ? t.btnPrimaryBg : t.border, color: interests.length > 0 ? t.btnPrimaryText : t.textDisabled, border: 'none', borderRadius: 10, padding: '15px', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', cursor: interests.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s', fontFamily: 'inherit' }}>
        Request quote ({interests.length} item{interests.length !== 1 ? 's' : ''}) →
      </button>
      <div style={{ textAlign: 'center', fontSize: 12, color: t.textDisabled, marginTop: 10 }}>Saved to our team. Track updates in {chatLabel}.</div>
    </div>
  );
}

export function ThanksView({ onBack, onOpenSupport, chatLabel = 'Trade Desk' }) {
  const { t } = useTheme();

  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, background: t.successBg, border: `0.5px solid ${t.successBorder}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: '1.5rem' }}>✓</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: '0.04em', color: t.text, marginBottom: 8 }}>Quote Requested!</div>
      <div style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.7, maxWidth: 400, marginBottom: '2rem' }}>
        Your quote request was submitted. Our team will reply in {chatLabel} — that is the best place for pricing, availability, and order questions.
      </div>
      {onOpenSupport && (
        <button onClick={onOpenSupport} style={{ background: t.accent, color: '#FFF', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
          Open {chatLabel}
        </button>
      )}
      <button onClick={onBack} style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Browse More Brands</button>
    </div>
  );
}
