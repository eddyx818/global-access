import React, { useState } from 'react';
import { repDisplayName } from '../lib/customerTransfer';
import { useTheme } from '../context/ThemeContext';
import { getAdminUi } from '../lib/theme';

export default function BulkTransferBar({ selectedCount, repOptions, onTransfer, onClear, busy = false }) {
  const { t } = useTheme();
  const ui = getAdminUi();
  const [targetRepId, setTargetRepId] = useState('');

  if (!selectedCount) return null;

  const handleTransfer = () => {
    onTransfer?.(targetRepId || null);
  };

  return (
    <div style={{
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      marginBottom: 12, padding: '10px 12px', borderRadius: 10,
      background: t.goldBg, border: `0.5px solid ${t.gold}`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
        {selectedCount} selected
      </span>
      <select
        value={targetRepId}
        onChange={(e) => setTargetRepId(e.target.value)}
        style={{ ...ui.input, fontSize: 12, padding: '6px 10px', minWidth: 180 }}
      >
        <option value="">Unassigned</option>
        {repOptions.map(r => (
          <option key={r.user_id} value={r.user_id}>
            {repDisplayName(r)}{r.rep_code ? ` (${r.rep_code})` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleTransfer}
        disabled={busy}
        style={{
          background: busy ? t.border : t.btnPrimaryBg,
          color: busy ? t.textFaint : t.btnPrimaryText,
          border: 'none', borderRadius: 8, padding: '8px 14px',
          fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}
      >
        {busy ? 'Transferring…' : `Transfer ${selectedCount}`}
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={busy}
        style={{ background: 'none', border: 'none', fontSize: 12, color: t.textMuted, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}
      >
        Clear selection
      </button>
    </div>
  );
}
