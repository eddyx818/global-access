import React, { useCallback, useEffect, useState } from 'react';
import { fetchRecentInquiries, updateInquiryQuoteStatus, QUOTE_STATUSES, parseInquiryInterests, deleteInquiry } from '../lib/inquiries';
import QuoteStatusBadge from './QuoteStatusBadge';
import QuoteBuilderPanel from './QuoteBuilderPanel';
import WhatsAppContactButton from './WhatsAppContactButton';
import { inquiryLeadWhatsAppMessage } from '../lib/inquiryWhatsApp';
import { COPY, portalType } from '../lib/portalCopy';
import { PortalPageHeader } from './PortalChrome';
import { useTheme } from '../context/ThemeContext';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function StaffQuotesView({ onCountsChange, isMobile = true, staffUserId = null, staffProfile = null }) {
  const { t } = useTheme();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState('');

  const syncCount = useCallback((rows) => {
    onCountsChange?.(rows.filter(i => (i.quote_status || 'new') === 'new').length);
  }, [onCountsChange]);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchRecentInquiries(50);
    setInquiries(rows);
    syncCount(rows);
    setLoading(false);
  }, [syncCount]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'new'
    ? inquiries.filter(i => (i.quote_status || 'new') === 'new')
    : filter === 'urgent'
      ? inquiries.filter(i => i.ready_to_order)
      : inquiries;

  const displayRows = [...filtered].sort((a, b) => {
    if (a.ready_to_order !== b.ready_to_order) return a.ready_to_order ? -1 : 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const cardStyle = {
    background: t.bgElevated,
    border: t.borderHairlineLight,
    borderRadius: 12,
    padding: isMobile ? '14px 16px' : '16px 18px',
    marginBottom: 10,
    position: 'relative',
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg, overflow: 'hidden' }}>
      <div style={{
        padding: isMobile ? '10px 1rem 12px' : '1rem 1.25rem',
        borderBottom: t.borderHairlineLight,
        background: t.bgElevated,
        flexShrink: 0,
      }}>
        <PortalPageHeader
          title={COPY.quotes}
          subtitle="Build quotes here, then open WhatsApp to reach the customer."
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[['all', 'All'], ['new', 'New'], ['urgent', COPY.readyToOrder]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} style={{
              background: filter === id ? t.btnPrimaryBg : t.bgMuted,
              color: filter === id ? t.btnPrimaryText : t.textMuted,
              border: filter === id ? `0.5px solid ${t.btnPrimaryBg}` : t.borderHairline,
              borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '12px 1rem calc(1rem + var(--ga-inset-bottom))' : '1rem 1.25rem' }}>
        {removeError && (
          <div style={{ fontSize: 13, color: t.error || '#c44', marginBottom: 12, lineHeight: 1.5 }}>{removeError}</div>
        )}
        {loading && <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 24 }}>Loading quotes…</div>}
        {!loading && displayRows.length === 0 && (
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 32, lineHeight: 1.6 }}>
            {filter === 'new' ? 'No new quote requests.' : filter === 'urgent' ? `No ${COPY.readyToOrder.toLowerCase()} requests.` : 'No customer quotes yet.'}
          </div>
        )}
        {!loading && displayRows.map(inq => {
          const interests = parseInquiryInterests(inq.interests);
          return (
            <div key={inq.id} style={cardStyle}>
              <button type="button" aria-label="Remove quote" disabled={removingId === inq.id} onClick={async () => {
                if (!window.confirm(`Remove quote for ${inq.company || inq.name || 'this customer'}?`)) return;
                setRemovingId(inq.id);
                setRemoveError('');
                const result = await deleteInquiry(inq.id);
                if (result.ok) {
                  setInquiries(prev => { const next = prev.filter(i => i.id !== inq.id); syncCount(next); return next; });
                } else {
                  setRemoveError(result.error || 'Could not remove quote.');
                }
                setRemovingId(null);
              }} style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', border: t.borderHairline, background: t.bgMuted, color: t.textMuted, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, paddingRight: 32 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{inq.name || '—'}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{inq.company || '—'}</div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{[inq.phone, inq.email].filter(Boolean).join(' · ')}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {inq.ready_to_order && (
                      <span style={{ ...portalType.badge, color: '#E85D4A', background: 'rgba(232,93,74,0.12)', borderRadius: 6, padding: '3px 8px' }}>
                        ⚡ {COPY.readyToOrder}
                      </span>
                    )}
                    {inq.pricing_questions && (
                      <span style={{ ...portalType.badge, color: '#C9A84C', background: 'rgba(201,168,76,0.15)', borderRadius: 6, padding: '3px 8px' }}>
                        💬 {COPY.pricingQuestions}
                      </span>
                    )}
                    {inq.contact_requested && (
                      <span style={{ ...portalType.badge, color: '#25D366', background: 'rgba(37,211,102,0.12)', borderRadius: 6, padding: '3px 8px' }}>
                        📱 Contact
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <QuoteStatusBadge status={inq.quote_status || 'new'} />
                  <div style={{ fontSize: 10, color: t.textFaint, marginTop: 6 }}>{formatWhen(inq.created_at)}</div>
                </div>
              </div>
              {interests.slice(0, 3).map(i => (
                <div key={i.key || i.sku} style={{ fontSize: 12, color: t.textSecondary, padding: '3px 0' }}>
                  {i.sku && <span style={{ fontFamily: 'monospace', fontSize: 10, color: t.gold, marginRight: 6 }}>{i.sku}</span>}
                  {i.brandName} — {i.productName}
                </div>
              ))}
              {inq.notes && <div style={{ fontSize: 12, color: t.textMuted, background: t.bgMuted, borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>{inq.notes}</div>}
              <div style={{ marginTop: 10 }}>
                <WhatsAppContactButton
                  customerPhone={inq.phone}
                  message={inquiryLeadWhatsAppMessage(inq, staffProfile)}
                  label="WhatsApp"
                  compact={isMobile}
                />
              </div>
              <select value={inq.quote_status || 'new'} disabled={updatingId === inq.id} onChange={async (e) => {
                setUpdatingId(inq.id);
                const result = await updateInquiryQuoteStatus(inq.id, e.target.value);
                if (result.ok) setInquiries(prev => { const next = prev.map(i => i.id === inq.id ? { ...i, quote_status: e.target.value } : i); syncCount(next); return next; });
                setUpdatingId(null);
              }} style={{ width: '100%', marginTop: 10, fontSize: 13, padding: '10px 12px', borderRadius: 8, border: t.borderHairline, background: t.inputBg, color: t.text, fontFamily: 'inherit' }}>
                {QUOTE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {staffUserId && (
                <QuoteBuilderPanel inquiry={inq} staffUserId={staffUserId} staffProfile={staffProfile} customerUserId={inq.user_id} compact
                  onUpdated={(updated) => setInquiries(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))}
                  onSent={(updated) => setInquiries(prev => { const next = prev.map(i => i.id === updated.id ? { ...i, ...updated } : i); syncCount(next); return next; })}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
