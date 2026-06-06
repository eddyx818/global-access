import React from 'react';

export function InterestView({ interests, toggleInterest, form, setForm, onSubmit, onBack, isMobile }) {
  const inputStyle = { width: '100%', background: '#F8F6F3', border: '0.5px solid #E0DDD8', borderRadius: 8, padding: '11px 12px', color: '#1A1A1A', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: isMobile ? '1rem' : '1.5rem 1.5rem 3rem' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#AAA', cursor: 'pointer', fontSize: 13, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit' }}>← Back</button>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, letterSpacing: '0.04em', color: '#1A1A1A', marginBottom: 4 }}>Your Interest List</div>
      <div style={{ fontSize: 13, color: '#AAA', marginBottom: '1.75rem', lineHeight: 1.6 }}>Tell us who you are and we'll reach out with pricing and availability before your meeting.</div>
      <div style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Selected items</div>
        {interests.length === 0 && <div style={{ fontSize: 13, color: '#CCC' }}>No items selected.</div>}
        {interests.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '0.5px solid #F0EDE8' }}>
            <div>
              <div style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{item.brandName} - {item.productName}</div>
              <div style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{item.flavor} · SKU: {item.sku}</div>
            </div>
            <button onClick={() => toggleInterest(item.sku, item.productName, item.brandName, item.flavor)} style={{ background: 'none', border: 'none', color: '#CCC', cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: 11, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Your details</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[['name','Name *'],['company','Company / Store *'],['phone','Phone / WhatsApp'],['email','Email']].map(([field, label]) => (
            <div key={field}>
              <label style={{ fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
              <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={inputStyle} autoCapitalize={field === 'email' ? 'none' : 'words'} />
            </div>
          ))}
        </div>
        <label style={{ fontSize: 11, color: '#AAA', display: 'block', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Notes (optional)</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Questions, timeline, or extra info..." style={{ ...inputStyle, height: 80, resize: 'none' }} />
      </div>
      <button onClick={onSubmit} disabled={interests.length === 0} style={{ width: '100%', background: interests.length > 0 ? '#1A1A1A' : '#E0DDD8', color: interests.length > 0 ? '#FFF' : '#AAA', border: 'none', borderRadius: 10, padding: '15px', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', cursor: interests.length > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s', fontFamily: 'inherit' }}>
        Send via WhatsApp →
      </button>
      <div style={{ textAlign: 'center', fontSize: 12, color: '#CCC', marginTop: 10 }}>Opens WhatsApp with your inquiry pre-filled.</div>
    </div>
  );
}

export function ThanksView({ onBack }) {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, background: '#F0FAF4', border: '0.5px solid #C6EDD7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: '1.5rem' }}>✓</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: '0.04em', color: '#1A1A1A', marginBottom: 8 }}>We Got It!</div>
      <div style={{ fontSize: 15, color: '#888', lineHeight: 1.7, maxWidth: 360, marginBottom: '2rem' }}>Your interest list has been sent to our team. We'll reach out within 1 business day.</div>
      <div style={{ background: '#FFF', border: '0.5px solid #E8E4DF', borderRadius: 12, padding: '1.25rem 2rem', marginBottom: '2rem', fontSize: 13, color: '#555' }}>
        <a href="https://wa.me/18183199888" style={{ color: '#1A1A1A', textDecoration: 'none', fontWeight: 500 }}>+1 (818) 319-9888</a><br />
        <span style={{ color: '#AAA', fontSize: 12 }}>WhatsApp · Text · Call</span>
      </div>
      <button onClick={onBack} style={{ background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Browse More Brands</button>
    </div>
  );
}
