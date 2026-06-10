import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { COPY } from '../lib/portalCopy';

export default function PricingPreviewToggle({
  userType = 'retailer',
  onChange,
  isMobile = false,
  compact = false,
}) {
  const { t, isNight } = useTheme();

  if (!onChange) return null;

  const glassSurface = {
    background: isNight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: isNight ? '0.5px solid rgba(255, 255, 255, 0.12)' : '0.5px solid rgba(0, 0, 0, 0.08)',
  };

  return (
    <div
      className="pricing-preview-toggle"
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 10 : 8,
        padding: compact ? '10px 16px' : '14px 16px 12px',
      }}
    >
      {!compact && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: t.textFaint,
        }}>
          Preview Pricing As
        </span>
      )}
      <div
        role="group"
        aria-label="Preview account type"
        style={{
          display: 'inline-flex',
          borderRadius: 10,
          overflow: 'hidden',
          ...glassSurface,
          background: isNight ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.72)',
        }}
      >
        {[
          ['retailer', COPY.retailerPricing],
          ['distributor', COPY.distributorPricing],
        ].map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            style={{
              padding: isMobile ? '8px 14px' : '8px 16px',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 700,
              letterSpacing: '0.02em',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: userType === type
                ? (isNight ? 'rgba(212, 180, 90, 0.32)' : 'rgba(201, 168, 76, 0.38)')
                : 'transparent',
              color: userType === type ? (isNight ? '#F0E2B0' : '#5C4808') : t.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
