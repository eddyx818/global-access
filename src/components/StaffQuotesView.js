import React, { useCallback, useEffect, useState } from 'react';
import { fetchRecentInquiries, updateInquiryQuoteStatus, QUOTE_STATUSES, parseInquiryInterests, deleteInquiry } from '../lib/inquiries';
import QuoteStatusBadge from './QuoteStatusBadge';
import QuoteBuilderPanel from './QuoteBuilderPanel';
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

export default function StaffQuotesView({ onCountsChange, isMobile = true, staffUserId = null }) {
  const { t } = useTheme();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

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
    : inquiries;

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
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: t.text }}>Quotes</div>
        <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.45, marginBottom: 10 }}>
          Customer quote requests — build and send quotes from here.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all', 'All'], ['new', 'New']].map(([id, label]) => (
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
        {loading && <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 24 }}>Loading quotes…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 32, lineHeight: 1.6 }}>
            {filter === 'new' ? 'No new quote requests.' : 'No customer quotes yet.'}
          </div>
        )}
        {!loading && filtered.map(inq => {
          const interests = parseInquiryInterests(inq.interests);
          return (
            <div key={inq.id} style={cardStyle}>
              <button type="button" aria-label="Remove quote" disabled={removingId === inq.id} onClick={async () => {
                if (!window.confirm(`Remove quote for ${inq.company || inq.name || 'this customer'}?`)) return;
                setRemovingId(inq.id);
                const result = await deleteInquiry(inq.id);
                if (result.ok) setInquiries(prev => { const next = prev.filter(i => i.id !== inq.id); syncCount(next); return next; });
                setRemovingId(null);
              }} style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: '50%', border: t.borderHairline, background: t.bgMuted, color: t.textMuted, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, paddingRight: 32 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{inq.name || '—'}</div>
                  <div style={{ fontSize: 12, color: t.textMuted }}>{inq.company || '—'}</div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{[inq.phone, inq.email].filter(Boolean).join(' · ')}</div>
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
              <select value={inq.quote_status || 'new'} disabled={updatingId === inq.id} onChange={async (e) => {
                setUpdatingId(inq.id);
                const result = await updateInquiryQuoteStatus(inq.id, e.target.value);
                if (result.ok) setInquiries(prev => { const next = prev.map(i => i.id === inq.id ? { ...i, quote_status: e.target.value } : i); syncCount(next); return next; });
                setUpdatingId(null);
              }} style={{ width: '100%', marginTop: 10, fontSize: 13, padding: '10px 12px', borderRadius: 8, border: t.borderHairline, background: t.inputBg, color: t.text, fontFamily: 'inherit' }}>
                {QUOTE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {staffUserId && (
                <QuoteBuilderPanel inquiry={inq} staffUserId={staffUserId} customerUserId={inq.user_id} compact
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
