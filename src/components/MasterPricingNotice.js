import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function MasterPricingNotice({ qualified, compact = false }) {
  const { t } = useTheme();

  if (qualified) {
    return (
      <div style={{
        background: t.warningBg,
        border: `0.5px solid ${t.warningBorder}`,
        borderRadius: compact ? 10 : 12,
        padding: compact ? '10px 14px' : '14px 16px',
        marginBottom: compact ? 0 : '1.25rem',
      }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: t.warningText, marginBottom: 4 }}>
          Master Distributor account
        </div>
        <div style={{ fontSize: compact ? 11 : 12, color: t.textMuted, lineHeight: 1.5 }}>
          Master rates appear on brands where we can publish them. On other brands, add items to your quote and our team will follow up with pricing.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: t.bgElevated,
      border: t.borderHairlineLight,
      borderRadius: compact ? 10 : 12,
      padding: compact ? '12px 14px' : '16px 18px',
      marginBottom: compact ? 0 : '1.25rem',
    }}>
      <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>
        High-volume orders?
      </div>
      <div style={{ fontSize: compact ? 11 : 12, color: t.textSecondary, lineHeight: 1.55 }}>
        Master Distributor pricing varies by brand and volume. Build your interest list as usual — mention volume in notes or chat and our team will review qualification and share rates where available.
      </div>
    </div>
  );
}
