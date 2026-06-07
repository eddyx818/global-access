import React, { useState } from 'react';
import { saveProfile } from '../lib/community';
import { useTheme } from '../context/ThemeContext';

export default function ScheduleCallRequest({ user, onSendMessage, isMobile = false }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const inputStyle = {
    width: '100%',
    background: t.inputBg,
    border: t.borderHairline,
    borderRadius: 8,
    padding: '10px 12px',
    color: t.text,
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const handleSend = async () => {
    if (!date || !time) {
      setError('Please pick a date and time.');
      return;
    }
    const appointmentAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(appointmentAt.getTime())) {
      setError('Invalid date or time.');
      return;
    }

    setBusy(true);
    setError('');
    setFeedback('');

    const formatted = appointmentAt.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
    const iso = appointmentAt.toISOString();

    const saveResult = await saveProfile(user.id, user.email, {
      preferred_appointment_at: iso,
      appointment_notes: notes.trim() || null,
    });

    if (!saveResult.ok) {
      setError(saveResult.error || 'Could not save your request.');
      setBusy(false);
      return;
    }

    try {
      await onSendMessage(
        `📅 Call request\n\nPreferred time: ${formatted}${notes.trim() ? `\n\nNotes: ${notes.trim()}` : ''}`
      );
      setFeedback('Sent — our team will confirm in chat.');
      setOpen(false);
      setDate('');
      setTime('');
      setNotes('');
    } catch (err) {
      setError(err?.message || 'Could not send message.');
    }
    setBusy(false);
  };

  return (
    <div style={{ borderTop: t.borderHairlineLight, background: t.bgMuted, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setError(''); setFeedback(''); }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: isMobile ? '10px 14px' : '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          color: t.textSecondary,
        }}
      >
        <span>📅 Schedule a call</span>
        <span style={{ fontSize: 10, color: t.textFaint }}>{open ? '▲' : '▼'}</span>
      </button>

      {feedback && !open && (
        <div style={{ padding: '0 14px 10px', fontSize: 11, color: t.successText }}>{feedback}</div>
      )}

      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.45, marginBottom: 10 }}>
            Send a preferred date and time directly to Support — no need to open Profile.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: t.textFaint, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What would you like to discuss? (optional)"
            style={{ ...inputStyle, height: 56, resize: 'none', marginBottom: 8 }}
          />
          {error && <div style={{ fontSize: 11, color: t.errorText, marginBottom: 8 }}>{error}</div>}
          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            style={{
              width: '100%',
              background: busy ? t.border : t.btnPrimaryBg,
              color: busy ? t.textDisabled : t.btnPrimaryText,
              border: 'none',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {busy ? 'Sending…' : 'Send call request'}
          </button>
        </div>
      )}
    </div>
  );
}
