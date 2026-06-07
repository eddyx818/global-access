import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { formatPrice } from '../lib/pricing';
import { parseInquiryInterests } from '../lib/inquiries';
import {
  enrichInquiryLines,
  fetchProductPricingBySkus,
  quoteLineTotal,
  quoteSubtotal,
  canSendQuote,
  updateInquiryQuoteLines,
  sendQuoteToCustomer,
  lineUnitLabel,
  fetchQuoteHistoryForInquiry,
  fetchQuoteHistoryForCustomer,
  compareLinesToHistory,
  updateQuoteHistoryStatus,
  QUOTE_FULFILLMENT_STATUSES,
} from '../lib/quoteBuilder';

function maxRevisionForInquiry(history, inquiryId) {
  return history
    .filter(h => h.inquiry_id === inquiryId)
    .reduce((max, h) => Math.max(max, h.revision || 0), 0);
}

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function QuoteBuilderPanel({
  inquiry,
  staffUserId,
  customerUserId = null,
  onUpdated,
  onSent,
  compact = false,
  defaultOpen = false,
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const [lines, setLines] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const wasQuoted = inquiry?.quote_status === 'quoted' || inquiry?.quote_status === 'closed';
  const lastSent = history.find(h => h.inquiry_id === inquiry.id) || history[0] || null;
  const nextRevision = maxRevisionForInquiry(history, inquiry.id) + 1;

  const loadAll = useCallback(async () => {
    if (!inquiry?.id) return;
    setLoading(true);
    setError('');
    const parsed = parseInquiryInterests(inquiry.interests);
    const skus = parsed.map(i => i.sku).filter(Boolean);
    const [catalogBySku, inquiryHistory, customerHistory] = await Promise.all([
      fetchProductPricingBySkus(skus),
      fetchQuoteHistoryForInquiry(inquiry.id),
      (customerUserId || inquiry.user_id)
        ? fetchQuoteHistoryForCustomer(customerUserId || inquiry.user_id, 20)
        : Promise.resolve([]),
    ]);
    const seen = new Set();
    const merged = [];
    [...inquiryHistory, ...customerHistory].forEach(row => {
      if (seen.has(row.id)) return;
      seen.add(row.id);
      merged.push(row);
    });
    merged.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
    setHistory(merged);
    setLines(enrichInquiryLines(inquiry, catalogBySku));
    setLoading(false);
  }, [inquiry, customerUserId]);

  useEffect(() => {
    if (open) loadAll();
  }, [open, loadAll]);

  const subtotal = useMemo(() => quoteSubtotal(lines), [lines]);
  const sendCheck = useMemo(() => canSendQuote(inquiry, lines), [inquiry, lines]);
  const verifiedCount = lines.filter(l => l.verified).length;
  const comparisons = useMemo(() => compareLinesToHistory(lines, lastSent), [lines, lastSent]);

  const updateLine = (index, patch) => {
    setLines(prev => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setMessage('');
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    const result = await updateInquiryQuoteLines(inquiry.id, lines);
    setSaving(false);
    if (!result.ok) {
      setError(result.error || 'Could not save quote.');
      return;
    }
    setMessage(wasQuoted ? 'Changes saved — send when ready to update the customer.' : 'Draft saved.');
    onUpdated?.({
      ...inquiry,
      interests: result.lines,
      quote_status: ['new', 'quoted', 'closed'].includes(inquiry.quote_status) ? 'in_review' : inquiry.quote_status,
    });
  };

  const handleSend = async () => {
    if (!sendCheck.ok) {
      setError(sendCheck.reason);
      return;
    }
    const confirmText = wasQuoted || history.length
      ? `Send revised quote (#${nextRevision}) to the customer's Messages inbox?`
      : 'Send this quote to the customer\'s Messages inbox?';
    if (!window.confirm(confirmText)) return;
    setSending(true);
    setError('');
    setMessage('');
    const result = await sendQuoteToCustomer(inquiry, lines, staffUserId, {
      revision: nextRevision,
      previousSubtotal: lastSent?.subtotal ?? null,
    });
    setSending(false);
    if (!result.ok) {
      setError(result.error || 'Could not send quote.');
      return;
    }
    setMessage(
      result.historySkipped
        ? 'Quote sent to customer. Run SQL migration 41 to enable quote history tracking.'
        : (wasQuoted || history.length ? `Revised quote #${result.revision} sent.` : 'Quote sent to customer.')
    );
    await loadAll();
    onSent?.({
      ...inquiry,
      interests: lines,
      quote_status: 'quoted',
      conversationId: result.conversationId,
    });
  };

  const handleHistoryStatus = async (historyId, status) => {
    const result = await updateQuoteHistoryStatus(historyId, status);
    if (!result.ok) {
      setError(result.error || 'Could not update status.');
      return;
    }
    setHistory(prev => prev.map(row => (row.id === historyId ? { ...row, fulfillment_status: status } : row)));
  };

  const loadHistoryIntoEditor = async (row) => {
    if (!row?.line_items?.length) return;
    if (!window.confirm('Load this quote into the editor? Unsaved changes will be replaced.')) return;
    const skus = row.line_items.map(i => i.sku).filter(Boolean);
    const catalogBySku = await fetchProductPricingBySkus(skus);
    setLines(enrichInquiryLines({ ...inquiry, interests: row.line_items }, catalogBySku));
    setMessage(`Loaded quote #${row.revision} from ${formatWhen(row.sent_at)}.`);
    setError('');
  };

  if (!inquiry?.id) return null;

  return (
    <div style={{
      marginTop: compact ? 8 : 12,
      borderRadius: 10,
      border: t.borderHairline,
      background: t.bgMuted,
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: compact ? '10px 12px' : '12px 14px',
          background: t.bgElevated,
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            {wasQuoted || history.length ? 'Edit & resend quote' : 'Review & send quote'}
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
            Verify SKUs, adjust prices, send to Messages
            {lines.length > 0 && ` · ${verifiedCount}/${lines.length} verified`}
            {history.length > 0 && ` · ${history.length} sent`}
          </div>
        </div>
        <span style={{ fontSize: 14, color: t.textFaint, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: compact ? '10px 12px 12px' : '12px 14px 14px' }}>
          {wasQuoted && (
            <div style={{ fontSize: 11, color: t.textSecondary, background: t.bgElevated, borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.45 }}>
              Quote already sent — edit prices below and use <strong>Send revised quote</strong> after back-and-forth with the customer.
            </div>
          )}

          {loading && (
            <div style={{ fontSize: 12, color: t.textFaint, padding: '8px 0' }}>Loading line items…</div>
          )}
          {!loading && lines.length === 0 && (
            <div style={{ fontSize: 12, color: t.textFaint, padding: '8px 0' }}>No line items on this request.</div>
          )}
          {!loading && lines.map((line, index) => {
            const unit = lineUnitLabel(line);
            const lineTotal = quoteLineTotal(line);
            const catalogHint = line.catalog_price != null ? formatPrice(line.catalog_price) : null;
            const comparison = comparisons[index];
            return (
              <div
                key={line.key || `${line.sku}-${index}`}
                style={{
                  padding: '10px 0',
                  borderBottom: index < lines.length - 1 ? t.borderHairlineLight : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer', paddingTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={!!line.verified}
                      onChange={(e) => updateLine(index, { verified: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: t.gold }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 700, color: line.verified ? t.successText : t.textFaint, letterSpacing: '0.04em' }}>
                      {line.verified ? 'OK' : 'Verify'}
                    </span>
                  </label>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.35 }}>
                      {line.sku && (
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: t.gold, marginRight: 6 }}>{line.sku}</span>
                      )}
                      {line.brandName} — {line.productName}
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      {line.flavor || '—'} · Qty {line.qty || 1} {unit}{(line.qty || 1) !== 1 ? 's' : ''}
                      {catalogHint && (
                        <span style={{ color: t.textFaint }}> · Catalog {catalogHint}/{unit}</span>
                      )}
                    </div>
                    {comparison?.lastQuoted != null && (
                      <div style={{
                        fontSize: 10,
                        marginTop: 4,
                        color: comparison.note === 'Same as last quoted price' ? t.successText : t.warningText,
                      }}>
                        Last quoted {formatPrice(comparison.lastQuoted)}/{unit}
                        {comparison.note ? ` · ${comparison.note}` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, color: t.textMuted }}>$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                          placeholder="0.00"
                          style={{
                            width: 88,
                            fontSize: 13,
                            padding: '6px 8px',
                            borderRadius: 8,
                            border: t.borderHairline,
                            background: t.inputBg,
                            color: t.text,
                            fontFamily: 'inherit',
                          }}
                        />
                        <span style={{ fontSize: 11, color: t.textMuted }}>/{unit}</span>
                      </div>
                      {lineTotal != null && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                          Line: {formatPrice(lineTotal)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && lines.length > 0 && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                marginTop: 4,
                borderTop: t.borderHairlineLight,
              }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>Estimated total</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{formatPrice(subtotal) || '—'}</span>
              </div>

              {!inquiry.user_id && (
                <div style={{ fontSize: 11, color: t.warningText, marginTop: 10, lineHeight: 1.45 }}>
                  Guest request — customer must have a portal account before you can send a quote to Messages.
                </div>
              )}

              {error && (
                <div style={{ fontSize: 11, color: t.errorText, marginTop: 10, lineHeight: 1.45 }}>{error}</div>
              )}
              {message && (
                <div style={{ fontSize: 11, color: t.successText, marginTop: 10, lineHeight: 1.45 }}>{message}</div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || sending || !lines.length}
                  style={{
                    background: t.bgElevated,
                    color: t.text,
                    border: t.borderHairline,
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: saving ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || saving || !sendCheck.ok}
                  title={!sendCheck.ok ? sendCheck.reason : 'Send quote to customer Messages'}
                  style={{
                    background: sendCheck.ok ? t.gold : t.bgSubtle,
                    color: sendCheck.ok ? '#1A1A1A' : t.textDisabled,
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: sending || !sendCheck.ok ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {sending
                    ? 'Sending…'
                    : (wasQuoted || history.length ? `Send revised quote (#${nextRevision})` : 'Send to customer')}
                </button>
              </div>
            </>
          )}

          {!loading && history.length > 0 && (
            <div style={{ marginTop: 14, borderTop: t.borderHairlineLight, paddingTop: 10 }}>
              <button
                type="button"
                onClick={() => setHistoryOpen(v => !v)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Quote history ({history.length})
                </span>
                <span style={{ fontSize: 12, color: t.textFaint }}>{historyOpen ? '▾' : '▸'}</span>
              </button>
              {historyOpen && history.map(row => (
                <div
                  key={row.id}
                  style={{
                    marginTop: 8,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: t.bgElevated,
                    border: t.borderHairlineLight,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>
                        Quote #{row.revision} · {formatWhen(row.sent_at)}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                        Total {formatPrice(row.subtotal) || '—'} · {(row.line_items || []).length} items
                      </div>
                    </div>
                    <select
                      value={row.fulfillment_status || 'sent'}
                      onChange={(e) => handleHistoryStatus(row.id, e.target.value)}
                      style={{
                        fontSize: 11,
                        padding: '4px 8px',
                        borderRadius: 8,
                        border: t.borderHairline,
                        background: t.inputBg,
                        fontFamily: 'inherit',
                      }}
                    >
                      {QUOTE_FULFILLMENT_STATUSES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadHistoryIntoEditor(row)}
                    style={{
                      marginTop: 8,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontSize: 11,
                      color: t.gold,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 600,
                    }}
                  >
                    Load into editor
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
