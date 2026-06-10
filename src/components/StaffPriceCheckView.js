import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { sendStaffPriceCheck } from '../lib/community';
import {
  fetchRecentPriceChecks,
  updatePriceCheckStatus,
  updatePriceCheckFields,
  deletePriceCheck,
  PRICE_CHECK_STATUSES,
  priceCheckStatusMeta,
  parsePriceCheckInterests,
  isPriceCheckEditable,
  countNewPriceChecks,
} from '../lib/priceChecks';
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

async function loadProfileMap(userIds) {
  if (!userIds.length) return {};
  const { data } = await supabase.from('user_profiles').select('user_id, name, company, username').in('user_id', userIds);
  const map = {};
  (data || []).forEach(p => { map[p.user_id] = p; });
  return map;
}

function staffDisplayName(profile) {
  if (!profile) return 'Staff member';
  return profile.name || profile.company || profile.username || 'Staff member';
}

function StatusBadge({ status }) {
  const meta = priceCheckStatusMeta(status);
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: 20,
      background: `${meta.color}18`, color: meta.color, border: `0.5px solid ${meta.color}44`,
    }}>{meta.label}</span>
  );
}

export default function StaffPriceCheckView({
  isMobile = true,
  staffUserId,
  isPortalAdmin = false,
  interests = [],
  toggleInterest,
  userType = 'retailer',
  onUserTypeChange,
  onCountsChange,
  onSubmitted,
}) {
  const { t } = useTheme();
  const [checks, setChecks] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [targetRates, setTargetRates] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [savingId, setSavingId] = useState(null);

  const inputStyle = {
    width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8,
    padding: '11px 12px', color: t.text, fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchRecentPriceChecks(50);
    setChecks(rows);
    onCountsChange?.(countNewPriceChecks(rows));
    const ids = [...new Set(rows.map(r => r.staff_user_id).filter(Boolean))];
    if (ids.length) setProfiles(await loadProfileMap(ids));
    setLoading(false);
  }, [onCountsChange]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!staffUserId) return;
    if (!accountName.trim() && !interests.length && !targetRates.trim()) {
      setFormError('Add a store/account name, SKUs from the catalog, or the customer\'s target rates.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const result = await sendStaffPriceCheck(staffUserId, {
        interests,
        userType,
        notes,
        accountName: accountName.trim(),
        targetRates: targetRates.trim(),
        source: 'catalog',
      });
      if (!result.saved) {
        setFormError(result.error || 'Could not save price check. Run SQL migration 43–44 in Supabase.');
        return;
      }
      setAccountName('');
      setTargetRates('');
      setNotes('');
      onSubmitted?.();
      await load();
    } catch (err) {
      setFormError(err?.message || 'Could not submit price check.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (check) => {
    setEditingId(check.id);
    setEditDraft({
      accountName: check.account_name || '',
      targetRates: check.target_rates || '',
      notes: check.notes || '',
      userType: check.user_type || 'retailer',
    });
  };

  const saveEdit = async (checkId) => {
    setSavingId(checkId);
    const result = await updatePriceCheckFields(checkId, editDraft);
    if (result.ok) {
      setChecks(prev => prev.map(c => c.id === checkId ? {
        ...c,
        account_name: editDraft.accountName,
        target_rates: editDraft.targetRates,
        notes: editDraft.notes,
        user_type: editDraft.userType,
      } : c));
      setEditingId(null);
    } else {
      window.alert(result.error || 'Could not save changes.');
    }
    setSavingId(null);
  };

  const cardStyle = {
    background: t.bgElevated,
    border: t.borderHairlineLight,
    borderRadius: 12,
    padding: isMobile ? '14px 16px' : '16px 18px',
    marginBottom: 10,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: isMobile ? '10px 1rem calc(1rem + var(--ga-inset-bottom))' : '1rem 1.25rem' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: '0.04em', color: t.text }}>Price check</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4, lineHeight: 1.45 }}>
            Internal pricing requests for the whole team — add SKUs from the catalog, name the store, and paste customer target rates.
          </div>
        </div>

        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>New price check</div>
          <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6 }}>Store / account name</label>
          <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="e.g. Joe's Market · ABC Distributors" style={{ ...inputStyle, marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['retailer', 'distributor'].map(type => (
              <button key={type} type="button" onClick={() => onUserTypeChange?.(type)} style={{
                flex: 1, padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: userType === type ? t.btnPrimaryBg : t.bgMuted,
                color: userType === type ? t.btnPrimaryText : t.textMuted,
                border: userType === type ? `0.5px solid ${t.btnPrimaryBg}` : t.borderHairline,
              }}>
                {type === 'distributor' ? 'Distributor pricing' : 'Retailer pricing'}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>SKUs from catalog ({interests.length})</div>
          {interests.length === 0 && <div style={{ fontSize: 12, color: t.textDisabled, marginBottom: 12 }}>Browse the catalog and add products first.</div>}
          {interests.map(item => (
            <div key={item.key || item.sku} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `0.5px solid ${t.borderSubtle}` }}>
              <div style={{ fontSize: 12, color: t.textSecondary }}>
                {item.sku && <span style={{ fontFamily: 'monospace', color: t.gold, marginRight: 6 }}>{item.sku}</span>}
                {item.brandName} — {item.productName}
              </div>
              <button type="button" onClick={() => toggleInterest?.(item.sku, item.productName, item.brandName, item.flavor)} style={{ background: 'none', border: 'none', color: t.textDisabled, fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <label style={{ fontSize: 11, color: t.textFaint, display: 'block', margin: '12px 0 6px' }}>Customer target rates / their quote</label>
          <textarea value={targetRates} onChange={e => setTargetRates(e.target.value)} placeholder="Paste the numbers they want to be at, line items, or counter-offer details…" style={{ ...inputStyle, height: 88, resize: 'vertical', marginBottom: 12 }} />
          <label style={{ fontSize: 11, color: t.textFaint, display: 'block', marginBottom: 6 }}>Notes for the team</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context, volume, competitor pricing…" style={{ ...inputStyle, height: 72, resize: 'vertical', marginBottom: 12 }} />
          {formError && <div style={{ fontSize: 12, color: t.errorText, marginBottom: 10 }}>{formError}</div>}
          <button type="button" onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 10,
            padding: '14px', fontSize: 14, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit',
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? 'Submitting…' : 'Submit to team'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Team price checks</div>
        {loading && <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 16 }}>Loading…</div>}
        {!loading && checks.length === 0 && (
          <div style={{ textAlign: 'center', color: t.textFaint, fontSize: 13, padding: 24, lineHeight: 1.6 }}>
            No price checks yet — submit one above or from a customer chat.
          </div>
        )}
        {!loading && checks.map(check => {
          const editable = isPriceCheckEditable(check.status);
          const isEditing = editingId === check.id;
          const items = parsePriceCheckInterests(check.interests);
          const submitter = profiles[check.staff_user_id];
          return (
            <div key={check.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: t.text }}>{check.account_name || 'Unnamed account'}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                    {check.user_type === 'distributor' ? 'Distributor' : 'Retailer'} · by {staffDisplayName(submitter)}
                    {check.source === 'chat' ? ' · from chat' : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <StatusBadge status={check.status} />
                  <div style={{ fontSize: 10, color: t.textFaint, marginTop: 6 }}>{formatWhen(check.created_at)}</div>
                </div>
              </div>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={editDraft.accountName} onChange={e => setEditDraft(d => ({ ...d, accountName: e.target.value }))} placeholder="Store / account name" style={inputStyle} />
                  <textarea value={editDraft.targetRates} onChange={e => setEditDraft(d => ({ ...d, targetRates: e.target.value }))} placeholder="Target rates" style={{ ...inputStyle, height: 80, resize: 'vertical' }} />
                  <textarea value={editDraft.notes} onChange={e => setEditDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Notes" style={{ ...inputStyle, height: 64, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => saveEdit(check.id)} disabled={savingId === check.id} style={{ flex: 1, background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ flex: 1, background: t.bgMuted, color: t.textMuted, border: t.borderHairline, borderRadius: 8, padding: '10px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  {items.slice(0, 5).map(i => (
                    <div key={i.key || i.sku} style={{ fontSize: 12, color: t.textSecondary, padding: '2px 0' }}>
                      {i.sku && <span style={{ fontFamily: 'monospace', fontSize: 10, color: t.gold, marginRight: 6 }}>{i.sku}</span>}
                      {i.brandName} — {i.productName}{i.qty ? ` · Qty ${i.qty}` : ''}
                    </div>
                  ))}
                  {check.target_rates && (
                    <div style={{ fontSize: 12, color: t.textMuted, background: t.bgMuted, borderRadius: 8, padding: '8px 10px', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                      <strong style={{ color: t.textSecondary }}>Target rates:</strong> {check.target_rates}
                    </div>
                  )}
                  {check.notes && (
                    <div style={{ fontSize: 12, color: t.textMuted, background: t.bgMuted, borderRadius: 8, padding: '8px 10px', marginTop: 8, whiteSpace: 'pre-wrap' }}>{check.notes}</div>
                  )}
                  <select value={priceCheckStatusMeta(check.status).id} disabled={savingId === check.id} onChange={async (e) => {
                    setSavingId(check.id);
                    const result = await updatePriceCheckStatus(check.id, e.target.value);
                    if (result.ok) setChecks(prev => { const next = prev.map(c => c.id === check.id ? { ...c, status: e.target.value } : c); onCountsChange?.(countNewPriceChecks(next)); return next; });
                    setSavingId(null);
                  }} style={{ width: '100%', marginTop: 10, fontSize: 13, padding: '10px 12px', borderRadius: 8, border: t.borderHairline, background: t.inputBg, color: t.text, fontFamily: 'inherit' }}>
                    {PRICE_CHECK_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {editable && (
                      <button type="button" onClick={() => startEdit(check)} style={{ flex: 1, background: t.bgMuted, color: t.textSecondary, border: t.borderHairline, borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                    )}
                    {isPortalAdmin && (
                      <button type="button" onClick={async () => {
                        if (!window.confirm('Remove this price check?')) return;
                        const result = await deletePriceCheck(check.id);
                        if (result.ok) setChecks(prev => { const next = prev.filter(c => c.id !== check.id); onCountsChange?.(countNewPriceChecks(next)); return next; });
                      }} style={{ background: t.bgMuted, color: t.errorText, border: t.borderHairline, borderRadius: 8, padding: '10px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
