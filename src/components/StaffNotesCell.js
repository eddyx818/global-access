import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

export default function StaffNotesCell({ value, onSave, placeholder = 'Add internal notes…' }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setEditing(false);
    return ok;
  };

  if (editing) {
    return (
      <div style={{ minWidth: 200 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ ...ui.input, fontSize: 12, width: '100%', resize: 'vertical', marginBottom: 6 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={save} disabled={saving}
            style={{ background: t.btnPrimaryBg, color: t.btnPrimaryText, border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => { setEditing(false); setDraft(value || ''); }}
            style={{ background: 'none', border: 'none', fontSize: 11, color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const preview = (value || '').trim();
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={preview || placeholder}
      style={{
        background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 12, color: preview ? t.textSecondary : t.textFaint,
        maxWidth: 220, lineHeight: 1.4,
      }}
    >
      {preview
        ? (preview.length > 80 ? `${preview.slice(0, 80)}…` : preview)
        : '+ Add notes'}
    </button>
  );
}
