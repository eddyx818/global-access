import React, { useState } from 'react';
import { sendStaffPriceCheck } from '../lib/community';
import { parseInquiryInterests } from '../lib/inquiries';
import { useTheme } from '../context/ThemeContext';

export default function ChatPriceCheckPanel({
  staffUserId,
  customerProfile,
  customerUserId,
  conversationId,
  customerInquiry,
  lastCustomerMessage = '',
  onSubmitted,
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [targetRates, setTargetRates] = useState('');
  const [notes, setNotes] = useState('');
  const [userType, setUserType] = useState('retailer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const defaultAccount = customerProfile?.company || customerProfile?.name || '';
  const inquiryInterests = parseInquiryInterests(customerInquiry?.interests);

  const openForm = () => {
    setAccountName(accountName || defaultAccount);
    setUserType(customerProfile?.user_type || customerInquiry?.user_type || 'retailer');
    setOpen(true);
  };

  const useLastMessage = () => {
    if (lastCustomerMessage?.trim()) setTargetRates(lastCustomerMessage.trim());
  };

  const submit = async () => {
    if (!staffUserId || !customerUserId) return;
    if (!accountName.trim() && !targetRates.trim() && !inquiryInterests.length) {
      setError('Add the store name or paste the customer\'s target rates.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await sendStaffPriceCheck(staffUserId, {
        interests: inquiryInterests,
        userType,
        notes,
        accountName: accountName.trim() || defaultAccount,
        targetRates: targetRates.trim(),
        customerUserId,
        customerConversationId: conversationId,
        source: 'chat',
      });
      if (!result.saved) {
        setError(result.error || 'Could not save. Run SQL migrations 43–44.');
        return;
      }
      setOpen(false);
      setTargetRates('');
      setNotes('');
      onSubmitted?.(result.row);
    } catch (err) {
      setError(err?.message || 'Could not submit price check.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: '100%', background: t.inputBg, border: t.borderHairline, borderRadius: 8,
    padding: '10px 12px', color: t.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  if (!open) {
    return (
      <button type="button" onClick={openForm} style={{
        width: '100%', marginBottom: 10, background: t.goldBg, color: t.gold, border: `0.5px solid ${t.gold}`,
        borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        Log price check for team
      </button>
    );
  }

  return (
    <div style={{ marginBottom: 10, padding: 12, background: t.warningBg, border: `0.5px solid ${t.warningBorder}`, borderRadius: 10 }}>
      <div style={{ fontSize: 10, color: t.warningText, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        Price check (internal — visible to all staff)
      </div>
      <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Store / account name" style={{ ...inputStyle, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['retailer', 'distributor'].map(type => (
          <button key={type} type="button" onClick={() => setUserType(type)} style={{
            flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            background: userType === type ? t.btnPrimaryBg : t.bgElevated,
            color: userType === type ? t.btnPrimaryText : t.textMuted,
            border: t.borderHairline,
          }}>{type === 'distributor' ? 'Distro' : 'Retail'}</button>
        ))}
      </div>
      {inquiryInterests.length > 0 && (
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>{inquiryInterests.length} line item(s) from latest quote request</div>
      )}
      <textarea value={targetRates} onChange={e => setTargetRates(e.target.value)} placeholder="Customer target rates / their counter-quote…" style={{ ...inputStyle, height: 80, resize: 'vertical', marginBottom: 8 }} />
      {lastCustomerMessage && (
        <button type="button" onClick={useLastMessage} style={{ background: 'none', border: 'none', color: t.gold, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, padding: 0 }}>
          Use last customer message
        </button>
      )}
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for pricing team…" style={{ ...inputStyle, height: 56, resize: 'vertical', marginBottom: 8 }} />
      {error && <div style={{ fontSize: 11, color: t.errorText, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={submit} disabled={busy} style={{ flex: 1, background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 8, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'Submitting…' : 'Submit to Price check tab'}
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ background: t.bgElevated, color: t.textMuted, border: t.borderHairline, borderRadius: 8, padding: '10px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  );
}
