import React from 'react';

export default function MasterPricingNotice({ qualified, hasInterest, onSetInterest, compact = false }) {
  if (qualified) {
    return (
      <div style={{
        background: '#FDF6E3',
        border: '0.5px solid #F5D87A',
        borderRadius: compact ? 10 : 12,
        padding: compact ? '10px 14px' : '14px 16px',
        marginBottom: compact ? 0 : '1.25rem',
      }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: '#A07A20', marginBottom: 4 }}>
          Master Distributor price list active
        </div>
        <div style={{ fontSize: compact ? 11 : 12, color: '#888', lineHeight: 1.5 }}>
          Your account has the private Master Distributor price list — visible only to qualified high-volume partners.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#FFF',
      border: '0.5px solid #E8E4DF',
      borderRadius: compact ? 10 : 12,
      padding: compact ? '12px 14px' : '16px 18px',
      marginBottom: compact ? 0 : '1.25rem',
    }}>
      <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 6 }}>
        High-volume orders?
      </div>
      <div style={{ fontSize: compact ? 11 : 12, color: '#666', lineHeight: 1.55, marginBottom: onSetInterest ? 12 : 0 }}>
        Master Distributor pricing is not per brand — it applies when your overall order volume qualifies.
        Build your interest list as usual; we review volume and unlock a private price list on your account if you qualify.
      </div>
      {onSetInterest && (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 12, color: '#555' }}>
          <input
            type="checkbox"
            checked={!!hasInterest}
            onChange={e => onSetInterest(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>I order high volume and want to be considered for Master Distributor pricing</span>
        </label>
      )}
    </div>
  );
}
