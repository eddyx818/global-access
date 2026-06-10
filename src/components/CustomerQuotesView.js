import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  fetchQuoteHistoryForCustomer,
  quoteSubtotal,
  respondToQuote,
  lineUnitLabel,
} from '../lib/quoteBuilder';
import { formatPrice } from '../lib/pricing';
import { COPY } from '../lib/portalCopy';
import { PortalPageHeader } from './PortalChrome';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function responseLabel(response) {
  if (response === 'accepted') return { text: 'Accepted', color: '#4CAF7D' };
  if (response === 'denied') return { text: 'Declined', color: '#AAA' };
  if (response === 'countered') return { text: 'Counter sent', color: '#C9A84C' };
  return null;
}

export default function CustomerQuotesView({ userId, isMobile = true }) {
  const { t } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [counterId, setCounterId] = useState(null);
  const [counterLines, setCounterLines] = useState([]);
  const [counterNotes, setCounterNotes] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const history = await fetchQuoteHistoryForCustomer(userId, 30);
    setRows(history);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const startCounter = (row) => {
    setCounterId(row.id);
    setCounterLines((row.line_items || []).map(line => ({
      ...line,
      qty: Number(line.qty) || 1,
    })));
    setCounterNotes('');
    setError('');
  };

  const handleRespond = async (historyId, response) => {
    setActingId(historyId);
    setError('');
    const payload = response === 'countered'
      ? { counterLines, counterNotes }
      : {};
    const result = await respondToQuote(historyId, response, payload);
    setActingId(null);
    if (!result.ok) {
      setError(result.error || 'Could not save your response.');
      return;
    }
    setCounterId(null);
    await load();
  };

  const cardStyle = {
    background: t.bgElevated,
    border: t.borderHairlineLight,
    borderRadius: 12,
    padding: isMobile ? '14px 16px' : '16px 18px',
    marginBottom: 12,
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
          title={COPY.myQuotes}
          subtitle="Accept, decline, or counter — we may also follow up on WhatsApp."
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '12px 1rem calc(1rem + var(--ga-inset-bottom))' : '1rem 1.25rem' }}>
        {error && (
          <div style={{ fontSize: 13, color: t.error || '#c44', marginBottom: 12, padding: '10px 12px', background: t.errorBg, borderRadius: 8 }}>
            {error}
          </div>
        )}
        {loading && <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 24 }}>Loading quotes…</div>}
        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 32, lineHeight: 1.6 }}>
            No quotes yet. Build a list from any brand, then submit from {COPY.myList}.
          </div>
        )}
        {!loading && rows.map(row => {
          const lines = row.line_items || [];
          const subtotal = row.subtotal != null ? Number(row.subtotal) : quoteSubtotal(lines);
          const status = responseLabel(row.customer_response);
          const pending = !row.customer_response || row.customer_response === 'pending';
          const isCountering = counterId === row.id;

          return (
            <div key={row.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Quote #{row.revision || 1}</div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>{formatWhen(row.sent_at)}</div>
                </div>
                {status && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: status.color, alignSelf: 'flex-start' }}>{status.text}</span>
                )}
              </div>
              {lines.map(line => {
                const qty = Number(line.qty) || 1;
                const unit = lineUnitLabel(line);
                const price = line.unit_price != null ? Number(line.unit_price) : null;
                return (
                  <div key={line.key || line.sku} style={{ fontSize: 12, color: t.textSecondary, padding: '4px 0', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
                    {line.brandName} — {line.productName}
                    {line.flavor ? ` (${line.flavor})` : ''}
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      {qty} {qty === 1 ? unit : `${unit}s`}
                      {price != null && !Number.isNaN(price) ? ` @ ${formatPrice(price)}/${unit}` : ''}
                    </div>
                  </div>
                );
              })}
              {subtotal != null && !Number.isNaN(subtotal) && (
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10, color: t.text }}>
                  Subtotal: {formatPrice(subtotal)}
                </div>
              )}
              {row.customer_response === 'countered' && row.customer_counter_notes && (
                <div style={{ fontSize: 12, color: t.textMuted, background: t.bgMuted, borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>
                  Your counter note: {row.customer_counter_notes}
                </div>
              )}
              {pending && !isCountering && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <button type="button" disabled={actingId === row.id} onClick={() => handleRespond(row.id, 'accepted')} style={{ flex: 1, minWidth: 90, background: '#4CAF7D', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Accept
                  </button>
                  <button type="button" disabled={actingId === row.id} onClick={() => startCounter(row)} style={{ flex: 1, minWidth: 90, background: t.gold, color: '#1A1A1A', border: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Counter
                  </button>
                  <button type="button" disabled={actingId === row.id} onClick={() => { if (window.confirm('Decline this quote?')) handleRespond(row.id, 'denied'); }} style={{ flex: 1, minWidth: 90, background: t.bgMuted, color: t.textMuted, border: t.borderHairline, borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Decline
                  </button>
                </div>
              )}
              {isCountering && (
                <div style={{ marginTop: 12, padding: '12px', background: t.bgMuted, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Counter offer</div>
                  {counterLines.map((line, idx) => (
                    <div key={line.key || line.sku || idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ flex: 1, fontSize: 11, color: t.textSecondary, minWidth: 0 }}>{line.productName || line.sku}</span>
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={e => {
                          const qty = Math.max(1, Number(e.target.value) || 1);
                          setCounterLines(prev => prev.map((l, i) => (i === idx ? { ...l, qty } : l)));
                        }}
                        style={{ width: 64, fontSize: 14, padding: '6px 8px', borderRadius: 6, border: t.borderHairline, background: t.inputBg, color: t.text, fontFamily: 'inherit' }}
                      />
                      <span style={{ fontSize: 11, color: t.textFaint }}>{lineUnitLabel(line)}s</span>
                    </div>
                  ))}
                  <textarea
                    value={counterNotes}
                    onChange={e => setCounterNotes(e.target.value)}
                    placeholder="Notes for our team (optional)"
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 14, padding: '8px 10px', borderRadius: 8, border: t.borderHairline, background: t.inputBg, color: t.text, fontFamily: 'inherit', height: 64, resize: 'none', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setCounterId(null)} style={{ flex: 1, background: 'none', border: t.borderHairline, borderRadius: 8, padding: '8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: t.textMuted }}>Cancel</button>
                    <button type="button" disabled={actingId === row.id} onClick={() => handleRespond(row.id, 'countered')} style={{ flex: 2, background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Send counter</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
