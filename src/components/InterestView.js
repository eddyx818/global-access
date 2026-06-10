import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { PHONE_PLACEHOLDER } from '../lib/catalogPricing';
import { COPY } from '../lib/portalCopy';
import { PortalPageHeader, PortalSectionLabel } from './PortalChrome';

function FollowUpOption({ checked, onChange, icon, title, detail, accent = false, t }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '13px 14px',
      borderRadius: 10,
      border: checked ? `1.5px solid ${accent ? '#E85D4A' : t.gold}` : t.borderHairline,
      background: checked ? (accent ? 'rgba(232,93,74,0.08)' : t.bgMuted) : t.bgElevated,
      cursor: 'pointer',
      marginBottom: 8,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 3, width: 18, height: 18, accentColor: accent ? '#E85D4A' : t.gold, flexShrink: 0 }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: t.text, lineHeight: 1.35 }}>
          {icon && <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>}
          {title}
        </span>
        {detail && <span style={{ display: 'block', fontSize: 12, color: t.textMuted, marginTop: 5, lineHeight: 1.5 }}>{detail}</span>}
      </span>
    </label>
  );
}

export function InterestView({
  interests,
  toggleInterest,
  form,
  setForm,
  onSubmit,
  onBack,
  isMobile,
  profileSaved = false,
  staffPriceCheck = false,
  submitError = '',
}) {
  const { t } = useTheme();
  const inputStyle = { width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8, padding: '11px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const lockedStyle = { ...inputStyle, opacity: 0.75, background: t.bgSubtle };

  const setReadyToOrder = (checked) => {
    setForm(f => ({
      ...f,
      readyToOrder: checked,
      contactRequested: checked ? true : f.contactRequested,
    }));
  };

  const itemWord = interests.length === 1 ? 'Item' : 'Items';

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: isMobile ? 'max(8px, var(--ga-inset-top)) 1rem 2rem' : '1.5rem 1.5rem 3rem' }}>
      {!isMobile && (
        <>
          <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: t.textFaint, cursor: 'pointer', fontSize: 13, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit' }}>← Back</button>
          <PortalPageHeader
            size={38}
            title={staffPriceCheck ? COPY.priceCheck : COPY.requestQuote}
            subtitle={staffPriceCheck
              ? 'Internal SKU list for your team — not sent to customers.'
              : 'Review your list, choose how we follow up, and submit.'}
            style={{ marginBottom: '1.5rem' }}
          />
        </>
      )}
      {isMobile && (
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: '1.25rem', lineHeight: 1.6 }}>
          {staffPriceCheck
            ? 'Build a SKU list, then finish on the Price Check tab.'
            : 'Review your list and tell us how to follow up.'}
        </div>
      )}

      <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <PortalSectionLabel>{COPY.myList} · {interests.length} {itemWord}</PortalSectionLabel>
        {interests.length === 0 && (
          <div style={{ fontSize: 13, color: t.textDisabled, lineHeight: 1.5 }}>
            Nothing selected yet — open a brand and tap flavors to add.
          </div>
        )}
        {interests.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
            <div style={{ minWidth: 0, paddingRight: 8 }}>
              <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>{item.brandName} — {item.productName}</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                {item.flavor} · {item.sku}
                {item.qty ? ` · ${item.qty}${item.orderUnitLabel ? ` ${item.orderUnitLabel}` : ''}` : ''}
              </div>
            </div>
            <button type="button" onClick={() => toggleInterest(item.sku, item.productName, item.brandName, item.flavor)} style={{ background: 'none', border: 'none', color: t.textDisabled, cursor: 'pointer', fontSize: 20, padding: '0 4px', lineHeight: 1, flexShrink: 0 }} aria-label="Remove">×</button>
          </div>
        ))}
      </div>

      {!staffPriceCheck && (
        <>
          <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <PortalSectionLabel>Follow-Up</PortalSectionLabel>
            <FollowUpOption
              t={t}
              accent
              icon="⚡"
              checked={!!form.readyToOrder}
              onChange={e => setReadyToOrder(e.target.checked)}
              title={COPY.readyToOrder}
              detail="Priority response on WhatsApp. Best when quantities are set and you want to move fast."
            />
            <FollowUpOption
              t={t}
              icon="💬"
              checked={!!form.pricingQuestions}
              onChange={e => setForm(f => ({ ...f, pricingQuestions: e.target.checked }))}
              title={COPY.pricingQuestions}
              detail="Questions on rates, MOQ, or shipping? Check this and add details in Notes."
            />
            <FollowUpOption
              t={t}
              icon="📱"
              checked={form.contactRequested !== false}
              onChange={e => setForm(f => ({ ...f, contactRequested: e.target.checked }))}
              title={COPY.whatsAppContact}
              detail={`Uses your number below. Uncheck for ${COPY.myQuotes} updates only.`}
            />
          </div>

          <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <PortalSectionLabel>{profileSaved ? 'Saved Details' : 'Your Details'}</PortalSectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[['name', 'Name *'], ['company', 'Company / Store *'], ['phone', 'Phone / WhatsApp *'], ['email', 'Email']].map(([field, label]) => (
                <div key={field}>
                  <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</label>
                  <input
                    value={form[field] || ''}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    readOnly={profileSaved && field !== 'email'}
                    style={profileSaved && field !== 'email' ? lockedStyle : inputStyle}
                    autoCapitalize={field === 'email' ? 'none' : 'words'}
                    inputMode={field === 'phone' ? 'tel' : field === 'email' ? 'email' : 'text'}
                    placeholder={field === 'phone' ? PHONE_PLACEHOLDER : undefined}
                  />
                </div>
              ))}
            </div>
            <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Timeline, delivery notes, or anything else for this order…"
              style={{ ...inputStyle, height: 80, resize: 'none' }}
            />
            {profileSaved && (
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 8 }}>
                Update name, company, or phone anytime in Profile.
              </div>
            )}
          </div>
        </>
      )}

      {staffPriceCheck && (
        <div style={{ background: t.bgElevated, border: t.borderHairlineLight, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
          <PortalSectionLabel>Team Notes</PortalSectionLabel>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Target rates, buyer context, or comparison to last quote…"
            style={{ ...inputStyle, height: 80, resize: 'none' }}
          />
        </div>
      )}

      {submitError && (
        <div style={{ fontSize: 13, color: t.error || '#c44', marginBottom: '1rem', lineHeight: 1.45, padding: '10px 12px', background: t.errorBg, borderRadius: 8, border: t.errorBorder }}>
          {submitError}
        </div>
      )}
      <button type="button" onClick={onSubmit} disabled={interests.length === 0} style={{ width: '100%', background: interests.length > 0 ? t.btnPrimaryBg : t.border, color: interests.length > 0 ? t.btnPrimaryText : t.textDisabled, border: 'none', borderRadius: 10, padding: '15px', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', cursor: interests.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
        {staffPriceCheck
          ? `${COPY.priceCheck} · ${interests.length} ${itemWord} →`
          : form.readyToOrder
            ? `Submit · ${COPY.readyToOrder} (${interests.length}) →`
            : `${COPY.requestQuote} · ${interests.length} ${itemWord} →`}
      </button>
      <div style={{ textAlign: 'center', fontSize: 12, color: t.textDisabled, marginTop: 10, lineHeight: 1.5 }}>
        {staffPriceCheck
          ? 'Internal only — not visible to customers.'
          : `Each brand ships separately · Track status in ${COPY.myQuotes}`}
      </div>
    </div>
  );
}

export function ThanksView({ onBack, onViewMyQuotes, onWhatsApp, staffPriceCheck = false, readyToOrder = false }) {
  const { t } = useTheme();

  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, background: t.successBg, border: `0.5px solid ${t.successBorder}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: '1.5rem' }}>✓</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: '0.06em', color: t.text, marginBottom: 8 }}>
        {staffPriceCheck ? 'Sent to Team' : (readyToOrder ? 'Request Received' : 'Quote Requested')}
      </div>
      <div style={{ fontSize: 14, color: t.textMuted, maxWidth: 360, lineHeight: 1.65, marginBottom: '1.5rem' }}>
        {staffPriceCheck
          ? `Your ${COPY.priceCheck.toLowerCase()} is in the team inbox.`
          : readyToOrder
            ? `Marked ${COPY.readyToOrder.toLowerCase()} — we'll prioritize WhatsApp follow-up. Pricing will appear in ${COPY.myQuotes}.`
            : `We received your list. Follow-up on WhatsApp when needed — pricing lands in ${COPY.myQuotes}.`}
      </div>
      {onViewMyQuotes && (
        <button type="button" onClick={onViewMyQuotes} style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, letterSpacing: '0.03em', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12 }}>
          Open {COPY.myQuotes}
        </button>
      )}
      {onWhatsApp && (
        <a href={onWhatsApp} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14, fontWeight: 600, letterSpacing: '0.02em', marginBottom: 12 }}>
          <span aria-hidden>💬</span> WhatsApp
        </a>
      )}
      <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: t.textFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to Catalog</button>
    </div>
  );
}
