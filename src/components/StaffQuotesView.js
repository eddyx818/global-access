import React, { useCallback, useEffect, useState } from 'react';
import { fetchRecentInquiries, updateInquiryQuoteStatus, QUOTE_STATUSES } from '../lib/inquiries';
import QuoteStatusBadge from './QuoteStatusBadge';
import { useTheme } from '../context/ThemeContext';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function StaffQuotesView({ onCountsChange, isMobile = true }) {
  const { t } = useTheme();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchRecentInquiries(50);
    setInquiries(rows);
    const newCount = rows.filter(i => (i.quote_status || 'new') === 'new').length;
    onCountsChange?.(newCount);
    setLoading(false);
  }, [onCountsChange]);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (inquiryId, status) => {
    setUpdatingId(inquiryId);
    const result = await updateInquiryQuoteStatus(inquiryId, status);
    if (result.ok) {
      setInquiries(prev => {
        const next = prev.map(i => (i.id === inquiryId ? { ...i, quote_status: status } : i));
        onCountsChange?.(next.filter(i => (i.quote_status || 'new') === 'new').length);
        return next;
      });
    }
    setUpdatingId(null);
  };

  const filtered = filter === 'new'
    ? inquiries.filter(i => (i.quote_status || 'new') === 'new')
    : inquiries;

  const cardStyle = {
    background: t.bgElevated,
    border: t.borderHairlineLight,
    borderRadius: 12,
    padding: isMobile ? '14px 16px' : '16px 18px',
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: t.bg,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: isMobile ? 'max(12px, var(--ga-inset-top)) 1rem 12px' : '1rem 1.25rem',
        borderBottom: t.borderHairlineLight,
        background: t.bgElevated,
        flexShrink: 0,
      }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: t.text }}>
            Quote inbox
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.45 }}>
            Recent customer quote requests — update status here or use Dashboard in the top bar for full detail.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['all', 'All'],
            ['new', 'New'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              style={{
                background: filter === id ? t.btnPrimaryBg : t.bgMuted,
                color: filter === id ? t.btnPrimaryText : t.textMuted,
                border: filter === id ? `0.5px solid ${t.btnPrimaryBg}` : t.borderHairline,
                borderRadius: 20,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: isMobile ? '12px 1rem calc(1rem + var(--ga-inset-bottom))' : '1rem 1.25rem',
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 24 }}>Loading quotes…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 32, lineHeight: 1.6 }}>
            {filter === 'new' ? 'No new quote requests right now.' : 'No inquiries yet.'}
          </div>
        )}
        {!loading && filtered.map(inq => {
          const interests = Array.isArray(inq.interests) ? inq.interests : [];
          return (
            <div key={inq.id} style={{ ...cardStyle, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>{inq.name || '—'}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{inq.company || '—'}</div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>
                    {[inq.phone, inq.email].filter(Boolean).join(' · ') || 'No contact on file'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <QuoteStatusBadge status={inq.quote_status || 'new'} />
                  <span style={{ fontSize: 10, color: t.textFaint }}>{formatWhen(inq.created_at)}</span>
                </div>
              </div>
              {interests.slice(0, 3).map(i => (
                <div key={i.key || `${i.brandName}-${i.productName}`} style={{ fontSize: 12, color: t.textSecondary, padding: '3px 0' }}>
                  {i.brandName} — {i.productName}{i.flavor ? ` · ${i.flavor}` : ''}
                </div>
              ))}
              {interests.length > 3 && (
                <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>+ {interests.length - 3} more items</div>
              )}
              {inq.notes && (
                <div style={{ fontSize: 12, color: t.textMuted, background: t.bgMuted, borderRadius: 8, padding: '8px 10px', marginTop: 8, lineHeight: 1.45 }}>
                  {inq.notes}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <select
                  value={inq.quote_status || 'new'}
                  disabled={updatingId === inq.id}
                  onChange={(e) => handleStatus(inq.id, e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: 13,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: t.borderHairline,
                    background: t.inputBg,
                    color: t.text,
                    fontFamily: 'inherit',
                  }}
                >
                  {QUOTE_STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
