import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { updateInquiryQuoteStatus, QUOTE_STATUSES, parseInquiryInterests, deleteInquiry } from '../lib/inquiries';
import {
  updatePriceCheckStatus,
  deletePriceCheck,
  PRICE_CHECK_STATUSES,
  priceCheckStatusMeta,
  parsePriceCheckInterests,
} from '../lib/priceChecks';
import { countNewInboxItems, fetchStaffInboxItems, filterInboxItems } from '../lib/staffInbox';
import QuoteStatusBadge from './QuoteStatusBadge';
import QuoteBuilderPanel from './QuoteBuilderPanel';
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

async function loadProfileMap(userIds) {
  if (!userIds.length) return {};
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, name, company, username, is_portal_admin, is_sales_rep')
    .in('user_id', userIds);
  const map = {};
  (data || []).forEach(p => { map[p.user_id] = p; });
  return map;
}

function staffDisplayName(profile) {
  if (!profile) return 'Staff member';
  return profile.name || profile.company || profile.username || 'Staff member';
}

function PriceCheckStatusBadge({ status }) {
  const meta = priceCheckStatusMeta(status);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding: '3px 10px',
      borderRadius: 20,
      background: `${meta.color}18`,
      color: meta.color,
      border: `0.5px solid ${meta.color}44`,
    }}>
      {meta.label}
    </span>
  );
}

function KindPill({ kind }) {
  const { t } = useTheme();
  const isQuote = kind === 'quote';
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '2px 8px',
      borderRadius: 6,
      background: isQuote ? t.goldBg : t.accentBg,
      color: isQuote ? t.gold : t.accentDark,
      border: isQuote ? `0.5px solid ${t.gold}44` : `0.5px solid ${t.accentBorder}`,
    }}>
      {isQuote ? 'Customer quote' : 'Price check'}
    </span>
  );
}

export default function StaffInboxView({
  onCountsChange,
  isMobile = true,
  staffUserId = null,
  isPortalAdmin = false,
  onOpenChat = null,
}) {
  const { t } = useTheme();
  const [items, setItems] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { items: merged, quotes, priceChecks } = await fetchStaffInboxItems(50);
    setItems(merged);
    onCountsChange?.(countNewInboxItems(quotes, priceChecks));

    const staffIds = priceChecks.map(c => c.staff_user_id).filter(Boolean);
    if (staffIds.length) {
      const loaded = await loadProfileMap([...new Set(staffIds)]);
      setProfiles(prev => ({ ...prev, ...loaded }));
    }
    setLoading(false);
  }, [onCountsChange]);

  const applyItems = useCallback((updater) => {
    setItems(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const quotes = next.filter(i => i.kind === 'quote').map(i => i.row);
      const checks = next.filter(i => i.kind === 'price_check').map(i => i.row);
      onCountsChange?.(countNewInboxItems(quotes, checks));
      return next;
    });
  }, [onCountsChange]);

  useEffect(() => { load(); }, [load]);

  const handleQuoteStatus = async (inquiryId, status) => {
    setUpdatingId(inquiryId);
    const result = await updateInquiryQuoteStatus(inquiryId, status);
    if (result.ok) {
      applyItems(prev => prev.map(item => (
        item.kind === 'quote' && item.row.id === inquiryId
          ? { ...item, row: { ...item.row, quote_status: status } }
          : item
      )));
    } else if (result.error) {
      window.alert(result.error);
    }
    setUpdatingId(null);
  };

  const handlePriceCheckStatus = async (checkId, status) => {
    setUpdatingId(checkId);
    const result = await updatePriceCheckStatus(checkId, status);
    if (result.ok) {
      applyItems(prev => prev.map(item => (
        item.kind === 'price_check' && item.row.id === checkId
          ? { ...item, row: { ...item.row, status } }
          : item
      )));
    } else if (result.error) {
      window.alert(result.error);
    }
    setUpdatingId(null);
  };

  const handleRemoveQuote = async (inq) => {
    const label = inq.company || inq.name || 'this quote';
    if (!window.confirm(`Remove quote request for ${label}? This cannot be undone.`)) return;
    setRemovingId(inq.id);
    const result = await deleteInquiry(inq.id);
    if (result.ok) {
      applyItems(prev => prev.filter(item => !(item.kind === 'quote' && item.row.id === inq.id)));
    } else if (result.error) {
      window.alert(result.error);
    }
    setRemovingId(null);
  };

  const handleRemovePriceCheck = async (check) => {
    if (!window.confirm('Remove this price check from the inbox? The Messages thread is kept.')) return;
    setRemovingId(check.id);
    const result = await deletePriceCheck(check.id);
    if (result.ok) {
      applyItems(prev => prev.filter(item => !(item.kind === 'price_check' && item.row.id === check.id)));
    } else if (result.error) {
      window.alert(result.error);
    }
    setRemovingId(null);
  };

  const handleQuoteUpdated = (updated) => {
    applyItems(prev => prev.map(item => (
      item.kind === 'quote' && item.row.id === updated.id
        ? { ...item, row: { ...item.row, ...updated } }
        : item
    )));
  };

  const handleQuoteSent = (updated) => {
    applyItems(prev => prev.map(item => (
      item.kind === 'quote' && item.row.id === updated.id
        ? { ...item, row: { ...item.row, ...updated } }
        : item
    )));
  };

  const filtered = filterInboxItems(items, filter);

  const cardStyle = {
    background: t.bgElevated,
    border: t.borderHairlineLight,
    borderRadius: 12,
    padding: isMobile ? '14px 16px' : '16px 18px',
  };

  const renderQuoteCard = (inq) => {
    const interests = parseInquiryInterests(inq.interests);
    return (
      <div key={`quote-${inq.id}`} style={{ ...cardStyle, marginBottom: 10, position: 'relative' }}>
        <button
          type="button"
          aria-label="Remove quote request"
          title="Remove permanently"
          disabled={removingId === inq.id}
          onClick={() => handleRemoveQuote(inq)}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: t.borderHairline,
            background: t.bgMuted,
            color: t.textMuted,
            fontSize: 18,
            lineHeight: 1,
            cursor: removingId === inq.id ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          ×
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, paddingRight: 32 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 6 }}><KindPill kind="quote" /></div>
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
            {i.sku && <span style={{ fontFamily: 'monospace', fontSize: 10, color: t.gold, marginRight: 6 }}>{i.sku}</span>}
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
            onChange={(e) => handleQuoteStatus(inq.id, e.target.value)}
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
        {staffUserId && (
          <QuoteBuilderPanel
            inquiry={inq}
            staffUserId={staffUserId}
            customerUserId={inq.user_id}
            compact
            onUpdated={handleQuoteUpdated}
            onSent={handleQuoteSent}
          />
        )}
      </div>
    );
  };

  const renderPriceCheckCard = (check) => {
    const interests = parsePriceCheckInterests(check.interests);
    const profile = profiles[check.staff_user_id];
    const canRemove = isPortalAdmin;

    return (
      <div key={`pc-${check.id}`} style={{ ...cardStyle, marginBottom: 10, position: 'relative' }}>
        {canRemove && (
          <button
            type="button"
            aria-label="Remove price check"
            title="Remove from inbox"
            disabled={removingId === check.id}
            onClick={() => handleRemovePriceCheck(check)}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: t.borderHairline,
              background: t.bgMuted,
              color: t.textMuted,
              fontSize: 18,
              lineHeight: 1,
              cursor: removingId === check.id ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            ×
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, paddingRight: canRemove ? 32 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 6 }}><KindPill kind="price_check" /></div>
            <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>{staffDisplayName(profile)}</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
              Preview pricing as {check.user_type === 'distributor' ? 'Distributor' : 'Retailer'}
            </div>
            <div style={{ fontSize: 11, color: t.textFaint, marginTop: 4 }}>
              Internal — reply in Messages; not sent to a customer account
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <PriceCheckStatusBadge status={check.status || 'new'} />
            <span style={{ fontSize: 10, color: t.textFaint }}>{formatWhen(check.created_at)}</span>
          </div>
        </div>
        {interests.slice(0, 4).map(i => (
          <div key={i.key || `${i.brandName}-${i.productName}`} style={{ fontSize: 12, color: t.textSecondary, padding: '3px 0' }}>
            {i.sku && <span style={{ fontFamily: 'monospace', fontSize: 10, color: t.gold, marginRight: 6 }}>{i.sku}</span>}
            {i.brandName} — {i.productName}{i.flavor ? ` · ${i.flavor}` : ''}
            {i.qty ? ` · Qty ${i.qty}` : ''}
          </div>
        ))}
        {interests.length > 4 && (
          <div style={{ fontSize: 11, color: t.textFaint, marginTop: 2 }}>+ {interests.length - 4} more items</div>
        )}
        {check.notes && (
          <div style={{ fontSize: 12, color: t.textMuted, background: t.bgMuted, borderRadius: 8, padding: '8px 10px', marginTop: 8, lineHeight: 1.45 }}>
            {check.notes}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <select
            value={check.status || 'new'}
            disabled={updatingId === check.id}
            onChange={(e) => handlePriceCheckStatus(check.id, e.target.value)}
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
            {PRICE_CHECK_STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            style={{
              width: '100%',
              marginTop: 10,
              background: t.bgMuted,
              color: t.textSecondary,
              border: t.borderHairline,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Open Messages to reply
          </button>
        )}
      </div>
    );
  };

  const emptyCopy = {
    new: 'Nothing new in the inbox right now.',
    quotes: 'No customer quote requests yet.',
    price_checks: 'No internal price checks yet. Use Price check in the catalog to ask the team for pricing.',
    all: 'Your inbox is empty — customer quotes and internal price checks will show up here.',
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
            Inbox
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.45 }}>
            Customer quote requests and internal price checks — one place for your team to triage and respond.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['all', 'All'],
            ['new', 'New'],
            ['quotes', 'Quotes'],
            ['price_checks', 'Price checks'],
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
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 24 }}>Loading inbox…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 32, lineHeight: 1.6 }}>
            {emptyCopy[filter] || emptyCopy.all}
          </div>
        )}
        {!loading && filtered.map(item => (
          item.kind === 'quote'
            ? renderQuoteCard(item.row)
            : renderPriceCheckCard(item.row)
        ))}
      </div>
    </div>
  );
}
